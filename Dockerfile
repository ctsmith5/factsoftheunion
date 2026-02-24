FROM node:20-alpine AS frontend

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM python:3.11-slim AS backend

WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Copy built frontend
COPY --from=frontend /app/dist ./static

ENV PORT=8000
EXPOSE 8000

CMD ["python", "main.py"]
