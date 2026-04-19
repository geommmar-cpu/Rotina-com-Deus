async function checkUrls() {
  const base = "https://rotina-com-deus.vercel.app/audios/";
  const urls = [
    "terco_misterios_gozosos_1.ogg",
    "terco_misterios_gozosos.mp3",
    "terco_misterios_gozosos.ogg",
    "bom_dia.mp3"
  ];

  for (const url of urls) {
    try {
      const res = await fetch(base + url, { method: "HEAD" });
      console.log(`${url}: ${res.status} ${res.statusText}`);
    } catch (e) {
      console.log(`${url}: FAILED`, e.message);
    }
  }
}

checkUrls();
