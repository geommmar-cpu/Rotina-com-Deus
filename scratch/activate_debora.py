import requests
import json
import sys
import io

# Forçar UTF-8 para evitar erros de encoding no Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

supabase_url = "https://oyakfsvettzcwterqgom.supabase.co"
supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95YWtmc3ZldHR6Y3d0ZXJxZ29tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI4NzI4NywiZXhwIjoyMDg5ODYzMjg3fQ.8DLWZcjPiIVHCVifX3LEnb-zA5Cj-P7XOz5vAU_tWpA"

phone = "5561991149453"
name = "Débora"
valid_until = "2027-04-21T23:59:59Z"

headers = {
    "apikey": supabase_key,
    "Authorization": f"Bearer {supabase_key}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

print(f"--- Iniciando Ativação: {phone} ({name}) ---")

# 1. Update/Upsert User
try:
    search_url = f"{supabase_url}/rest/v1/whatsapp_users?phone_number=eq.{phone}"
    search_res = requests.get(search_url, headers=headers)
    search_res.raise_for_status()
    users = search_res.json()

    if users:
        print("Usuário já existe. Atualizando...")
        update_url = f"{supabase_url}/rest/v1/whatsapp_users?phone_number=eq.{phone}"
        data = {
            "full_name": name,
            "subscription_status": "active",
            "subscription_valid_until": valid_until
        }
        res = requests.patch(update_url, headers=headers, json=data)
        res.raise_for_status()
        print("Usuário atualizado com sucesso no Supabase.")
    else:
        print("Criando novo usuário...")
        insert_url = f"{supabase_url}/rest/v1/whatsapp_users"
        data = {
            "phone_number": phone,
            "full_name": name,
            "subscription_status": "active",
            "subscription_valid_until": valid_until
        }
        res = requests.post(insert_url, headers=headers, json=data)
        res.raise_for_status()
        print("Usuário criado com sucesso no Supabase.")
except Exception as e:
    print(f"Erro no Supabase: {e}")

# 2. Get Instance Credentials
try:
    print("Buscando credenciais da Evolution API...")
    inst_url = f"{supabase_url}/rest/v1/whatsapp_instances?is_primary=eq.true&status=eq.active"
    inst_res = requests.get(inst_url, headers=headers)
    inst_res.raise_for_status()
    instances = inst_res.json()

    if instances:
        instance = instances[0]
        instance_name = instance['instance_name']
        api_url = instance['api_url']
        api_key = instance['api_key']
        print(f"Usando instância: {instance_name}")

        # 3. Send Messages
        welcome_msg = (
            "✨ *Acesso Premium Liberado!* ✨\n\n"
            f"Olá, *{name}*! Sua jornada no *Rotina com Deus* foi ativada com sucesso. 🙏\n\n"
            "Sua constância começa agora. Estamos muito felizes em ter você conosco!\n\n"
            "Digite *MENU* para ver as opções e iniciar sua caminhada!"
        )
        
        personal_msg = (
            "🌹 *Uma mensagem especial do Geomar:* 🌹\n\n"
            "Débora, o Geomar pediu para te dizer que ele te ama muito. "
            "Você é a dona deste número e a dona do coração dele! ❤️✨\n\n"
            "Que sua caminhada com Deus seja leve e abençoada. Bem-vinda!"
        )

        def send_message(text):
            send_url = f"{api_url}/message/sendText/{instance_name}"
            payload = {"number": phone, "text": text}
            headers_evo = {"Content-Type": "application/json", "apikey": api_key}
            resp = requests.post(send_url, headers=headers_evo, json=payload)
            return resp.status_code, resp.text

        print("Enviando mensagem de boas-vindas...")
        status1, res1 = send_message(welcome_msg)
        print(f"Status Boas-vindas: {status1} - {res1}")

        print("Enviando mensagem romântica...")
        status2, res2 = send_message(personal_msg)
        print(f"Status Romântica: {status2} - {res2}")
    else:
        print("ERRO: Nenhuma instância ativa encontrada.")
except Exception as e:
    print(f"Erro na Evolution API: {e}")

print("--- Processo Finalizado ---")
