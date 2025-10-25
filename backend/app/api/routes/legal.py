from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
import base64
import io
import wave
import os
from openai import OpenAI
from app.core.config import settings
from app.schemas import AudioResponse, ContextResponse, ModelRequest

router = APIRouter()

# Boson AI client configuration
def get_boson_client():
    """Get Boson AI client with proper error handling"""
    if not settings.BOSON_API_KEY:
        raise HTTPException(
            status_code=500, 
            detail="Boson API key not configured. Please set BOSON_API_KEY environment variable."
        )
    return OpenAI(api_key=settings.BOSON_API_KEY, base_url="https://hackathon.boson.ai/v1")

# Available models
AVAILABLE_MODELS = [
    "higgs-audio-generation-Hackathon",
    "Qwen3-32B-thinking-Hackathon", 
    "Qwen3-32B-non-thinking-Hackathon",
    "Qwen3-14B-Hackathon",
    "higgs-audio-understanding-Hackathon",
    "Qwen3-Omni-30B-A3B-Thinking-Hackathon"
]

# Pregenerated context history (placeholder for now)
CONTEXT_HISTORY = """
Legal Context History:
- Client: John Doe
- Case Type: Personal Injury
- Date of Incident: March 15, 2024
- Previous consultations: 3 sessions completed
- Key issues discussed: Liability assessment, insurance coverage, potential settlement range
- Next steps: Medical evaluation completion, witness interviews scheduled
- Documents reviewed: Police report, medical records, insurance policy
"""

@router.get("/context", response_model=ContextResponse)
async def get_context_history():
    """
    Get the current context history for the legal case.
    For now, returns a pregenerated string.
    """
    return ContextResponse(context=CONTEXT_HISTORY)

@router.post("/upload-audio")
async def upload_audio(audio_file: UploadFile = File(...)):
    """
    Upload audio file containing user's voice question.
    Returns the transcribed text from the audio.
    """
    if not audio_file.content_type or not audio_file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio file")
    
    try:
        # Read audio file content
        audio_content = await audio_file.read()
        
        # Convert to base64 for Boson AI API
        audio_b64 = base64.b64encode(audio_content).decode("utf-8")
        
        # Use Boson AI for audio understanding
        client = get_boson_client()
        response = client.chat.completions.create(
            model="higgs-audio-understanding-Hackathon",
            messages=[
                {
                    "role": "user", 
                    "content": [{
                        "type": "input_audio",
                        "input_audio": {"data": audio_b64, "format": "wav"}
                    }]
                }
            ],
            modalities=["text", "audio"],
            max_completion_tokens=4096,
            temperature=0.3,
            stream=False,
        )
        
        transcribed_text = response.choices[0].message.content
        
        return {
            "message": "Audio uploaded and transcribed successfully",
            "transcribed_text": transcribed_text,
            "filename": audio_file.filename
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing audio: {str(e)}")

@router.post("/process-with-model", response_model=AudioResponse)
async def process_with_model(request: ModelRequest):
    """
    Process a question using one of the available AI models.
    Can optionally include context history.
    """
    try:
        # Prepare the context
        context = request.context or CONTEXT_HISTORY # todo real context here
        
        # Prepare system message based on model type
        system_message = (
            "You are an AI legal assistant designed to convert text into speech.\n"
            "If the user's message includes a [SPEAKER*] tag, do not read out the tag and generate speech for the following text, using the specified voice.\n"
            "If no speaker tag is present, select a suitable voice on your own.\n\n"
            "<|scene_desc_start|>\nAudio is recorded from a quiet room.\n<|scene_desc_end|>"
        )

        
        # Create the conversation
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": f"Context: {context}\n\nQuestion: {request.question}"}
        ]
        
        # Make API call to Boson AI
        client = get_boson_client()
        response = client.chat.completions.create(
            model=request.model,
            messages=messages,
            modalities=["text", "audio"] if "audio-generation" in request.model else ["text"],
            max_completion_tokens=4096,
            temperature=0.3,
            top_p=0.8,
            stream=False,
            stop=["<|eot_id|>", "<|end_of_text|>", "<|audio_eos|>"],
            extra_body={"top_k": 20},
        )
        
        response_content = response.choices[0].message.content
        audio_data = None
        
        # If it's an audio generation model, extract audio data
        if "audio-generation" in request.model and hasattr(response.choices[0].message, 'audio'):
            audio_data = response.choices[0].message.audio.data
        
        return AudioResponse(
            message=response_content,
            audio_data=audio_data
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing with model: {str(e)}")

@router.get("/models")
async def get_available_models():
    """
    Get list of available AI models.
    """
    return {
        "available_models": AVAILABLE_MODELS,
        "model_descriptions": {
            "higgs-audio-generation-Hackathon": "Audio generation model for creating speech from text",
            "Qwen3-32B-thinking-Hackathon": "Large language model with thinking capabilities (32B parameters)",
            "Qwen3-32B-non-thinking-Hackathon": "Large language model without thinking (32B parameters)", 
            "Qwen3-14B-Hackathon": "Medium language model (14B parameters)",
            "higgs-audio-understanding-Hackathon": "Audio understanding model for speech-to-text",
            "Qwen3-Omni-30B-A3B-Thinking-Hackathon": "Omni-modal model with thinking capabilities (30B parameters)"
        }
    }

@router.post("/generate-audio-response")
async def generate_audio_response(
    text: str = Form(...),
    voice: str = Form(default="belinda")
):
    """
    Generate audio response from text using the audio generation model.
    """
    try:
        client = get_boson_client()
        response = client.audio.speech.create(
            model="higgs-audio-generation-Hackathon",
            voice=voice,
            input=text,
            response_format="pcm"
        )
        
        # Convert PCM to WAV
        num_channels = 1        
        sample_width = 2        
        sample_rate = 24000   
        
        pcm_data = response.content
        
        # Create WAV file in memory
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav:
            wav.setnchannels(num_channels)
            wav.setsampwidth(sample_width)
            wav.setframerate(sample_rate)
            wav.writeframes(pcm_data)
        
        wav_buffer.seek(0)
        
        return StreamingResponse(
            io.BytesIO(wav_buffer.getvalue()),
            media_type="audio/wav",
            headers={"Content-Disposition": "attachment; filename=response.wav"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating audio: {str(e)}")
