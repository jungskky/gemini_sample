import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import AsyncOpenAI

GOOGLE_API_KEY = "AIzaSyClpxKgMkrDo0RgkkVnh-6Dbi-ZWUapdZA"

# OpenAI 호환 모드를 사용하여 Gemini API 연결
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

class ChatRequest(BaseModel):
    message: str

async def get_gemini_response(user_input: str):
    try:
        # OpenAI 라이브러리의 Chat Completions API 포맷 사용
        response = await client.chat.completions.create(
            model="gemini-1.5-pro", # 현재 호환성이 보장되는 모델로 임의 변경 (원하시는 모델명으로 수정 가능)
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You MUST think step-by-step before answering. "
                        "Enclose your complete thinking process inside <think> and </think> tags. "
                        "After closing the </think> tag, provide your final answer to the user in a clear and friendly manner. "
                        "Do not include any <think> tags in your final answer."
                    )
                },
                {"role": "user", "content": user_input}
            ],
            stream=True,
        )

        async for chunk in response:
            content = chunk.choices[0].delta.content
            if content:
                yield content
                
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
