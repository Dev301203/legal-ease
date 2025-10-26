import json

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, FileResponse
import base64
import io
import wave
import os
from openai import OpenAI
from app.core.config import settings
from app.core.db import engine
from app.crud import get_case_context, get_messages_by_tree, get_selected_messages_between
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

# audio helper
def b64(path):
    return base64.b64encode(open(path, "rb").read()).decode("utf-8")


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



@router.post("/transcribe-audio")
async def transcribe_audio(audio_file: UploadFile = File(...)):
    """
    Upload .wav audio file containing user's voice question.
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
                {"role": "system", "content": "Transcribe this audio for me."},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_audio",
                            "input_audio": {
                                "data": audio_b64,
                                "format": "wav",  # Assumed wav file uploads.
                            },
                        },
                    ],
                },
            ],
            max_completion_tokens=256,
            temperature=0.0,
        )

        transcribed_text = response.choices[0].message.content
        
        return AudioResponse(
            message=transcribed_text
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing audio: {str(e)}")
    
@router.post("/summarize-dialogue")
async def summarize_dialogue(data: str, desired_length: int):
    """
    Takes in a string describing what you want summarized, the desired length to summarize it to.
    Returns a shortened summary about desired_length words long, as if a lawyer said it.
    """
    try:

        client = get_boson_client()
        response = client.chat.completions.create(
            model="Qwen3-32B-thinking-Hackathon",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                #{"role": "user", "content": "Imagine you are a lawyer in a negotiation. Say only 8 words to summarize the following. Do not say anything else or think:\n" + data}
                {"role": "user", "content": "Imagine you are a lawyer in a negotiation. Say only " + str(desired_length) + " words to summarize the following. Do not say anything else or think: " + data}
            ],
            max_tokens=128,
            temperature=0.7
        ) # response is of form <think>\n\n</think>\n\n`ANSWER`


        return {"message": response.choices[0].message.content.split("\n")[4]}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error summarizing in get-headline: {str(e)}")

async def summarize_background_helper(data: str, desired_lines: int) -> str:
    """
    Helper function to summarize text using AI.
    Takes in a string describing what you want summarized, the desired lines to summarize it to.
    Returns a shortened summary about desired_lines number of lines long.
    """
    try:
        client = get_boson_client()
        response = client.chat.completions.create(
            model="Qwen3-32B-thinking-Hackathon",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Say a maximum of " + str(desired_lines) + " lines to summarize the following. Do not say anything else or think: " + data}
                # {"role": "user", "content": "Say a maximum of " + str(desired_lines) + " lines to summarize the following. If you do not need to say much, don't say much. Do not say anything else or think: " + data}
            ],
            max_tokens=4096,
            temperature=0.7
        )

        return response.choices[0].message.content.split("\n")[4]
    except Exception as e:
        raise Exception(f"Error summarizing: {str(e)}")


@router.post("/summarize-background")
async def summarize_background(data: str, desired_lines: int):
    """
    API endpoint to summarize text.
    Takes in a string describing what you want summarized, the desired lines to summarize it to.
    Returns a shortened summary about desired_lines number of lines long.
    """
    result = await summarize_background_helper(data, desired_lines)
    return {"message": result}

@router.get("/get-conversation-audio/{tree_id}")
async def get_conversation_audio(tree_id: int, end_message_id: int, session: Session = Depends(get_session)):
    """
    Takes a tree_id, for which it gets conversation history messages from the database in order.
    Returns the generated audio file as wav.
    """

    try:
        # messages = get_messages_by_tree(session, tree_id)
        messages = get_messages_by_tree(session, tree_id, end_message_id)

        tts_string = ""

        speaker = 0  # 0 is belinda, 1 is man_en. Pick this based on who you want to speak first.
        for message in messages:
            tts_string += "[SPEAKER" + str(speaker) + "] " + message + "\n"
            speaker = 1-speaker # alternate [SPEAKER0] and [SPEAKER1]
        

        # audio generation
        # Get the absolute path to the sample_audios directory
        current_dir = os.path.dirname(os.path.abspath(__file__))
        app_dir = os.path.dirname(os.path.dirname(current_dir))  # Go up from routes to app
        reference_path0 = os.path.join(app_dir, "sample_audios", "belinda.wav")
        reference_transcript0 = (
            "[SPEAKER0]"
            "T'was the night before my birthday." 
            "Hurray! It's almost here!"
            "It may not be a holiday, but it's the best day of the year."
        )
        reference_path1 = os.path.join(app_dir, "sample_audios", "en_man.wav")
        reference_transcript1 = (
            "[SPEAKER1] Maintaining your ability to learn translates into increased marketability, improved career options, and higher salaries."
        )
        system = (
            "You are an AI assistant designed to convert text into speech.\n"
            "If the user's message includes a [SPEAKER*] tag, do not read out the tag and generate speech for the following text, using the specified voice.\n"
            "If no speaker tag is present, select a suitable voice on your own.\n\n"
            "<|scene_desc_start|>\nAudio is recorded from a quiet room.\n<|scene_desc_end|>"
        )
        client = get_boson_client()
        resp = client.chat.completions.create(
            model="higgs-audio-generation-Hackathon",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": reference_transcript0},
                {
                    "role": "assistant",
                    "content": [{
                        "type": "input_audio",
                        "input_audio": {"data": b64(reference_path0), "format": "wav"}
                    }],
                },
                {"role": "user", "content": reference_transcript1},
                {
                    "role": "assistant",
                    "content": [{
                        "type": "input_audio",
                        "input_audio": {"data": b64(reference_path1), "format": "wav"}
                    }],
                },
                {"role": "user", "content": tts_string},
            ],
            modalities=["text", "audio"],
            max_completion_tokens=4096,
            temperature=1.0,
            top_p=0.95,
            stream=False,
            stop=["<|eot_id|>", "<|end_of_text|>", "<|audio_eos|>"],
            extra_body={"top_k": 50},
        )

        audio_b64 = resp.choices[0].message.audio.data
        open(str(end_message_id) + ".wav", "wb").write(base64.b64decode(audio_b64))
        return FileResponse(str(end_message_id) + ".wav", media_type="audio/wav")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing conversation: {str(e)}")