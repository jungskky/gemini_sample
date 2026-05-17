import os
import google.generativeai as genai
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

GOOGLE_API_KEY = "AIzaSyClpxKgMkrDo0RgkkVnh-6Dbi-ZWUapdZA"
genai.configure(api_key=GOOGLE_API_KEY)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

async def get_gemini_response(user_input: str):
    try:
        model = genai.GenerativeModel('models/gemini-3.1-pro-preview')

        prompt = (
            f"{user_input}\n\n"
            "---\n"
            "System Instruction: You MUST think step-by-step before answering. "
            "Enclose your complete thinking process inside <think> and </think> tags. "
            "After closing the </think> tag, provide your final answer to the user in a clear and friendly manner. "
            "Do not include any <think> tags in your final answer."
        )

        response = await model.generate_content_async(prompt, stream=True)

        async for chunk in response:
            if chunk.text:
                yield chunk.text
    except Exception as e:
        yield f"Error: {str(e)}"

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    return StreamingResponse(
        get_gemini_response(request.message),
        media_type="text/plain"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)