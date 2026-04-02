import requests
import sys
import os

# Configurações
BASE_URL = "https://oyakfsvettzcwterqgom.supabase.co/functions/v1/whatsapp-cron"

def test_routine(routine_type, force=True):
    url = f"{BASE_URL}?type={routine_type}&force={'true' if force else 'false'}"
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95YWtmc3ZldHR6Y3d0ZXJxZ29tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI4NzI4NywiZXhwIjoyMDg5ODYzMjg3fQ.8DLWZcjPiIVHCVifX3LEnb-zA5Cj-P7XOz5vAU_tWpA"
    }
    
    if force:
        # Adiciona um header ou param se implementarmos lógica de force
        pass

    print(f"🚀 Disparando rotina: {routine_type}...")
    print(f"📡 URL: {url}")
    
    try:
        response = requests.get(url, headers=headers)
        print(f"✅ Status Code: {response.status_code}")
        print(f"📄 Resposta: {response.text}")
    except Exception as e:
        print(f"❌ Erro ao disparar: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python test-routine.py [morning|noon|night]")
        sys.exit(1)
        
    routine = sys.argv[1]
    if routine not in ["morning", "noon", "night"]:
        print("Erro: Escolha entre morning, noon ou night.")
        sys.exit(1)
        
    test_routine(routine)
