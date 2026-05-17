import google.generativeai as genai

genai.configure(api_key="AIzaSyAgDll_9HygKr9-9KNYNW4Wdz4fiFbPJKU")

print("--- 사용 가능한 모델 목록 ---")
for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        print(f"모델명: {m.name}")