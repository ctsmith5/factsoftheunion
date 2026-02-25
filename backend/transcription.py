import asyncio
import json
import os
import re
import subprocess
import time
from datetime import datetime
from typing import Callable, Awaitable, Optional

from deepgram import DeepgramClient, LiveTranscriptionEvents, LiveOptions

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")

# Keywords that suggest a checkable factual claim
CLAIM_KEYWORDS = re.compile(
    r"\b("
    r"million|billion|trillion|thousand|hundred|percent|%"
    r"|created|eliminated|reduced|increased|doubled|tripled"
    r"|lowest|highest|best|worst|greatest|most|least|record"
    r"|saved|spent|cut|raised|invested|built"
    r"|more than|less than|over|under|nearly|almost|approximately"
    r"|every|all|no one|nobody|everyone|always|never"
    r"|inflation|unemployment|gdp|deficit|debt|economy|growth"
    r"|crime|border|illegal|fentanyl|drug"
    r")\b",
    re.IGNORECASE,
)

# Minimum word count for a sentence to be considered a potential claim
MIN_CLAIM_WORDS = 8


class TranscriptionManager:
    """Manages live audio transcription from a YouTube stream via Deepgram."""

    def __init__(
        self,
        on_transcript: Callable[[str], Awaitable[None]],
        on_claim: Callable[[str], Awaitable[None]],
    ):
        self.on_transcript = on_transcript
        self.on_claim = on_claim
        self._process: Optional[subprocess.Popen] = None
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._dg_connection = None
        self._sentence_buffer: list[str] = []
        self.youtube_url: Optional[str] = None
        self.started_at: Optional[str] = None
        self.metadata: Optional[dict] = None
        self._chunks_received: int = 0
        self._bytes_received: int = 0
        self._last_chunk_at: float = 0
        self._error: Optional[str] = None

    @property
    def is_running(self) -> bool:
        return self._running

    def status(self) -> dict:
        has_audio = (
            self._running
            and self._last_chunk_at > 0
            and (time.time() - self._last_chunk_at) < 5
        )
        return {
            "running": self._running,
            "youtube_url": self.youtube_url,
            "started_at": self.started_at,
            "sentences_buffered": len(self._sentence_buffer),
            "metadata": self.metadata,
            "audio": {
                "chunks_received": self._chunks_received,
                "bytes_received": self._bytes_received,
                "has_audio": has_audio,
            },
            "error": self._error,
        }

    async def start(self, youtube_url: str) -> None:
        if self._running:
            raise RuntimeError("Transcription is already running")

        if not DEEPGRAM_API_KEY:
            raise RuntimeError("DEEPGRAM_API_KEY is not set")

        self.youtube_url = youtube_url
        self.started_at = datetime.now().isoformat()
        self._running = True
        self._sentence_buffer = []
        self.metadata = None
        self._chunks_received = 0
        self._bytes_received = 0
        self._last_chunk_at = 0
        self._error = None

        # Fetch YouTube metadata before starting the pipeline
        try:
            meta_result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: subprocess.run(
                    ["yt-dlp", "--dump-json", "--no-download", youtube_url],
                    capture_output=True,
                    text=True,
                    timeout=15,
                ),
            )
            if meta_result.returncode == 0 and meta_result.stdout.strip():
                raw = json.loads(meta_result.stdout)
                self.metadata = {
                    "title": raw.get("title"),
                    "channel": raw.get("uploader") or raw.get("channel"),
                    "description": (raw.get("description") or "")[:300],
                    "is_live": raw.get("is_live", False),
                    "thumbnail": raw.get("thumbnail"),
                }
        except Exception as e:
            print(f"[Transcription] Failed to fetch metadata: {e}")

        self._task = asyncio.create_task(self._run(youtube_url))

    async def stop(self) -> None:
        """User-initiated stop — clean up and reset all state."""
        await self._cleanup()
        self.youtube_url = None
        self.started_at = None
        self.metadata = None
        self._chunks_received = 0
        self._bytes_received = 0
        self._last_chunk_at = 0
        self._error = None

    async def _cleanup(self) -> None:
        """Tear down subprocesses and connections without resetting status."""
        self._running = False

        if self._process and self._process.poll() is None:
            self._process.terminate()
            try:
                self._process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._process.kill()
            self._process = None

        if self._dg_connection:
            try:
                await self._dg_connection.finish()
            except Exception:
                pass
            self._dg_connection = None

        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _run(self, youtube_url: str) -> None:
        loop = asyncio.get_event_loop()

        try:
            # Set up Deepgram live transcription
            dg_client = DeepgramClient(DEEPGRAM_API_KEY)
            self._dg_connection = dg_client.listen.asyncwebsocket.v("1")

            async def on_message(_self, result, **kwargs):
                transcript = result.channel.alternatives[0].transcript
                if not transcript:
                    return

                # Broadcast every transcript fragment to the frontend
                await self.on_transcript(transcript)

                # On sentence-final results, buffer and check for claims
                if result.is_final:
                    self._sentence_buffer.append(transcript)

                    # Check if the sentence looks like a factual claim
                    if self._is_potential_claim(transcript):
                        await self.on_claim(transcript)

            async def on_error(_self, error, **kwargs):
                print(f"[Deepgram] Error: {error}")

            self._dg_connection.on(LiveTranscriptionEvents.Transcript, on_message)
            self._dg_connection.on(LiveTranscriptionEvents.Error, on_error)

            options = LiveOptions(
                model="nova-2",
                language="en-US",
                smart_format=True,
                interim_results=True,
                utterance_end_ms="1000",
                vad_events=True,
                encoding="linear16",
                sample_rate=16000,
                channels=1,
            )

            if not await self._dg_connection.start(options):
                self._error = "Deepgram connection failed — check API key"
                print(f"[Deepgram] {self._error}")
                return

            # Spawn yt-dlp | ffmpeg subprocess for audio extraction
            cmd = (
                f"yt-dlp -f bestaudio -o - '{youtube_url}' 2>&1 | "
                f"ffmpeg -i pipe:0 -f s16le -ar 16000 -ac 1 pipe:1"
            )
            self._process = await loop.run_in_executor(
                None,
                lambda: subprocess.Popen(
                    cmd,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                ),
            )

            # Read stderr in background to capture errors
            async def _read_stderr():
                lines = []
                while self._process and self._process.stderr:
                    line = await loop.run_in_executor(
                        None, self._process.stderr.readline
                    )
                    if not line:
                        break
                    decoded = line.decode("utf-8", errors="replace").strip()
                    if decoded:
                        lines.append(decoded)
                        print(f"[yt-dlp/ffmpeg] {decoded}")
                if lines and self._chunks_received == 0:
                    # Only surface error if no audio was ever received
                    self._error = lines[-1][:200]

            stderr_task = asyncio.create_task(_read_stderr())

            # Stream audio chunks to Deepgram
            chunk_size = 4096
            while self._running:
                data = await loop.run_in_executor(
                    None, self._process.stdout.read, chunk_size
                )
                if not data:
                    if self._chunks_received == 0 and not self._error:
                        self._error = "yt-dlp produced no audio data — video may be unavailable or URL invalid"
                    break
                self._chunks_received += 1
                self._bytes_received += len(data)
                self._last_chunk_at = time.time()
                await self._dg_connection.send(data)

            stderr_task.cancel()

        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"[Transcription] Error: {e}")
            self._error = str(e)[:200]
        finally:
            await self._cleanup()

    def _is_potential_claim(self, text: str) -> bool:
        """Heuristic: does this sentence look like a checkable factual claim?"""
        words = text.split()
        if len(words) < MIN_CLAIM_WORDS:
            return False
        return bool(CLAIM_KEYWORDS.search(text))
