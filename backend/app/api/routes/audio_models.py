import json

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
import base64
import io
import wave
import os
from openai import OpenAI
from app.core.config import settings
from app.core.db import engine
from app.crud import get_case_context, get_messages_by_tree
from app.schemas import AudioResponse, ContextResponse, messages_to_conversation
from sqlmodel import Session
from fastapi import APIRouter, Depends

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


def get_session():
    with Session(engine) as session:
        yield session


@router.get("/context/{case_id}/{tree_id}", response_model=ContextResponse)
async def get_context_history(case_id: int, tree_id: int, session: Session = Depends(get_session),) -> ContextResponse:
    """
    Get the current context history for the legal case.
    For now, returns a pregenerated string.
    """

    case_context = get_case_context(session, case_id)
    messages_history = get_messages_by_tree(session, tree_id)
    conversation_json = messages_to_conversation(messages_history).model_dump_json(
        indent=2)

    context_str = case_context + conversation_json
    return ContextResponse(context=context_str)



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
        
        return AudioResponse(
            message="Audio uploaded and transcribed successfully",
            audio_data=transcribed_text
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing audio: {str(e)}")