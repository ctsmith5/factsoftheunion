import asyncio
import os
import re
import subprocess
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

    @property
    def is_running(self) -> bool:
        return self._running

    def status(self) -> dict:
        return {
            "running": self._running,
            "youtube_url": self.youtube_url,
            "started_at": self.started_at,
            "sentences_buffered": len(self._sentence_buffer),
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
        self._task = asyncio.create_task(self._run(youtube_url))

    async def stop(self) -> None:
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

        self.youtube_url = None
        self.started_at = None

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
                print("[Deepgram] Failed to start connection")
                self._running = False
                return

            # Spawn yt-dlp | ffmpeg subprocess for audio extraction
            cmd = (
                f"yt-dlp -f bestaudio -o - '{youtube_url}' | "
                f"ffmpeg -i pipe:0 -f s16le -ar 16000 -ac 1 pipe:1"
            )
            self._process = await loop.run_in_executor(
                None,
                lambda: subprocess.Popen(
                    cmd,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                ),
            )

            # Stream audio chunks to Deepgram
            chunk_size = 4096
            while self._running:
                data = await loop.run_in_executor(
                    None, self._process.stdout.read, chunk_size
                )
                if not data:
                    break
                await self._dg_connection.send(data)

        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"[Transcription] Error: {e}")
        finally:
            self._running = False
            await self.stop()

    def _is_potential_claim(self, text: str) -> bool:
        """Heuristic: does this sentence look like a checkable factual claim?"""
        words = text.split()
        if len(words) < MIN_CLAIM_WORDS:
            return False
        return bool(CLAIM_KEYWORDS.search(text))
