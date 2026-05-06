import requests
import json
import uuid

# URL of your edge function (local or production)
# Local: http://localhost:54321/functions/v1/whatsapp-webhook
# Prod: https://YOUR_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook
URL = "http://localhost:54321/functions/v1/whatsapp-webhook"

def test_webhook(instance_name):
    payload = {
        "event": "messages.upsert",
        "instance": instance_name,
        "data": {
            "key": {
                "id": str(uuid.uuid4()),
                "remoteJid": "5561984585912@s.whatsapp.net",
                "fromMe": False
            },
            "message": {
                "conversation": "Teste de segurança"
            }
        }
    }
    
    print(f"Testing with instance: {instance_name}...")
    try:
        response = requests.post(URL, json=payload)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Test 1: Wrong Instance
    test_webhook("saldin-principal")
    
    print("-" * 20)
    
    # Test 2: Correct Instance
    # Note: This will only work if EVOLUTION_INSTANCE is set to "rotina-principal" in your environment
    test_webhook("rotina-principal")
