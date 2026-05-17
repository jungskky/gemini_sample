import os
from openai import AsyncOpenAI
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

GOOGLE_API_KEY = "AIzaSyClpxKgMkrDo0RgkkVnh-6Dbi-ZWUapdZA"

client = AsyncOpenAI(
    api_key=GOOGLE_API_KEY,
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[Message] = []

async def get_gemini_response(user_input: str, history: List[Message]):
    try:
        messages = [
            {"role": "system", "content": "You MUST think step-by-step before answering. Enclose your complete thinking process inside <think> and </think> tags. After closing the </think> tag, provide your final answer to the user in a clear and friendly manner. Do not include any <think> tags in your final answer."}
        ]
        
        for msg in history:
            messages.append({"role": msg.role, "content": msg.content})
            
        messages.append({"role": "user", "content": user_input})

        response = await client.chat.completions.create(
            model="gemini-1.5-pro",
            messages=messages,
            stream=True
        )

        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except Exception as e:
        yield f"Error: {str(e)}"

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    return StreamingResponse(
        get_gemini_response(request.message, request.history),
        media_type="text/plain"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
