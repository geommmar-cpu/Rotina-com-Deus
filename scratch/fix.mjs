const URL = "https://oyakfsvettzcwterqgom.supabase.co/rest/v1/whatsapp_users";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95YWtmc3ZldHR6Y3d0ZXJxZ29tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI4NzI4NywiZXhwIjoyMDg5ODYzMjg3fQ.8DLWZcjPiIVHCVifX3LEnb-zA5Cj-P7XOz5vAU_tWpA";

async function upsertUser(phone) {
  const headers = {
    "apikey": KEY,
    "Authorization": `Bearer ${KEY}`,
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
  };
  
  const getRes = await fetch(`${URL}?phone_number=eq.${phone}`, { headers });
  const users = await getRes.json();
  
  const payload = {
    phone_number: phone,
    subscription_status: "active",
    subscription_valid_until: "2027-12-31T23:59:59Z"
  };

  if (users.length > 0) {
    console.log(`Atualizando ${phone}...`);
    const id = users[0].id;
    const patchRes = await fetch(`${URL}?id=eq.${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload)
    });
    if(patchRes.ok) console.log(`[OK] ${phone} atualizado com sucesso.`);
    else console.error(`[ERRO] ${phone}:`, await patchRes.text());
  } else {
    console.log(`Inserindo ${phone}...`);
    const postRes = await fetch(URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    if(postRes.ok) console.log(`[OK] ${phone} inserido com sucesso.`);
    else console.error(`[ERRO] ${phone}:`, await postRes.text());
  }
}

async function run() {
  await upsertUser("556199960291");
  await upsertUser("556191149453");
}
run();
