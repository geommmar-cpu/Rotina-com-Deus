import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Configurações do Supabase - SUBSTITUA AQUI COM SUAS CREDENCIAIS
const SUPABASE_URL = process.env.SUPABASE_URL || 'COLE_SEU_URL_AQUI';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'COLE_SUA_SERVICE_ROLE_KEY_AQUI';
const BUCKET_NAME = 'audios'; // Troque se o seu bucket tiver outro nome

if (!SUPABASE_URL.startsWith('http') || SUPABASE_KEY.startsWith('COLE')) {
    console.error('❌ Erro: Por favor, configure SUPABASE_URL e SUPABASE_KEY no arquivo upload_audios.mjs');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function uploadFiles() {
    const audiosDir = path.resolve('.');
    const files = fs.readdirSync(audiosDir).filter(f => f.endsWith('.mp3'));

    console.log(`Encontrados ${files.length} arquivos de áudio. Iniciando upload...`);

    for (const file of files) {
        const filePath = path.join(audiosDir, file);
        const fileContent = fs.readFileSync(filePath);
        
        console.log(`Uploading: ${file}...`);
        
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(file, fileContent, {
                contentType: 'audio/mpeg',
                upsert: true // Sobrescreve se já existir
            });

        if (error) {
            console.error(`❌ Erro no upload de ${file}:`, error.message);
        } else {
            console.log(`✅ Sucesso: ${file}`);
        }
    }
    console.log('🎉 Upload finalizado!');
}

uploadFiles().catch(console.error);
