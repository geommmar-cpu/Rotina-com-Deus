$supabaseUrl = "https://oyakfsvettzcwterqgom.supabase.co"
$supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95YWtmc3ZldHR6Y3d0ZXJxZ29tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI4NzI4NywiZXhwIjoyMDg5ODYzMjg3fQ.8DLWZcjPiIVHCVifX3LEnb-zA5Cj-P7XOz5vAU_tWpA"
$phone = "5561991149453"
$name = "Débora"
$validUntil = "2027-04-21T23:59:59Z"

$headers = @{
    "apikey" = $supabaseKey
    "Authorization" = "Bearer $supabaseKey"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}

Write-Host "Verificando usuário $phone..."

# 1. Buscar usuário
$findUrl = "$supabaseUrl/rest/v1/whatsapp_users?phone_number=eq.$phone"
try {
    $userRes = Invoke-RestMethod -Uri $findUrl -Headers $headers -Method Get
} catch {
    Write-Host "Erro ao buscar usuário: $_"
    exit
}

if ($null -eq $userRes -or $userRes.Count -eq 0) {
    Write-Host "Criando novo usuário..."
    $body = @{
        phone_number = $phone
        full_name = $name
        subscription_status = "active"
        subscription_valid_until = $validUntil
    } | ConvertTo-Json
    try {
        Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/whatsapp_users" -Headers $headers -Method Post -Body $body
        Write-Host "Usuário criado com sucesso."
    } catch {
        Write-Host "Erro ao criar usuário: $_"
        # Pode falhar se user_id for obrigatório. Nesse caso, ignoramos e tentamos enviar a mensagem assim mesmo.
    }
} else {
    Write-Host "Atualizando usuário existente..."
    $body = @{
        full_name = $name
        subscription_status = "active"
        subscription_valid_until = $validUntil
    } | ConvertTo-Json
    try {
        Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/whatsapp_users?phone_number=eq.$phone" -Headers $headers -Method Patch -Body $body
        Write-Host "Usuário atualizado com sucesso."
    } catch {
        Write-Host "Erro ao atualizar usuário: $_"
    }
}

# 2. Buscar Instância
Write-Host "Buscando instância ativa..."
$instUrl = "$supabaseUrl/rest/v1/whatsapp_instances?is_primary=eq.true&status=eq.active"
$instRes = Invoke-RestMethod -Uri $instUrl -Headers $headers -Method Get

if ($instRes.Count -gt 0) {
    $instance = $instRes[0]
    $apiUrl = $instance.api_url
    $apiKey = $instance.api_key
    $instanceName = $instance.instance_name
    Write-Host "Usando instância $instanceName..."

    # 3. Enviar Mensagens
    $welcomeMsg = "✨ *Acesso Premium Liberado!* ✨`n`nOlá, *${name}*! Sua jornada no *Rotina com Deus* foi ativada com sucesso. 🙏`n`nSua constância começa agora. Estamos muito felizes em ter você conosco!`n`nDigite *MENU* para ver as opções e iniciar sua caminhada!"
    
    # Mensagem bonita e romântica
    $personalMsg = "🌹 *Uma mensagem especial do Geomar:* 🌹`n`nDébora, o Geomar pediu para te dizer que ele te ama muito. Você é a dona deste número e a dona do coração dele! ❤️✨`n`nQue sua caminhada com Deus seja leve e abençoada. Bem-vinda!"

    $evoHeaders = @{
        "Content-Type" = "application/json"
        "apikey" = $apiKey
    }

    Write-Host "Enviando mensagem de boas-vindas..."
    $body1 = @{ number = $phone; text = $welcomeMsg } | ConvertTo-Json -Compress
    $res1 = Invoke-WebRequest -Uri "$apiUrl/message/sendText/$instanceName" -Headers $evoHeaders -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($body1))
    Write-Host "Resposta 1: $($res1.Content)"

    Write-Host "Enviando mensagem romântica..."
    $body2 = @{ number = $phone; text = $personalMsg } | ConvertTo-Json -Compress
    $res2 = Invoke-WebRequest -Uri "$apiUrl/message/sendText/$instanceName" -Headers $evoHeaders -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($body2))
    Write-Host "Resposta 2: $($res2.Content)"
} else {
    Write-Host "Nenhuma instância ativa encontrada."
}
