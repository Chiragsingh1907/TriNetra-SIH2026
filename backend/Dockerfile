FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies required for scientific libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Accept the Hugging Face token as a build argument
ARG HF_TOKEN
ENV HF_TOKEN=$HF_TOKEN

# Execute the download using the authenticated token
RUN python -c "\
import os; \
from transformers import AutoTokenizer, AutoModelForTokenClassification; \
token = os.environ.get('HF_TOKEN'); \
model_name = 'ai4bharat/indic-bert'; \
print('Downloading NLP weights for air-gapped deployment...'); \
AutoTokenizer.from_pretrained(model_name, token=token); \
AutoModelForTokenClassification.from_pretrained(model_name, token=token); \
print('Download complete.');"

# Copy the rest of the backend source code
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Start the FastAPI server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
