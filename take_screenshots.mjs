import puppeteer from 'puppeteer';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



// Wait a bit for server to start
setTimeout(async () => {
    try {
        const outDir = path.join(__dirname, 'depoimentos_imagens');
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir);
        }

        console.log('Iniciando navegador...');
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        // Set viewport width to simulate a mobile screen so the cards look good
        await page.setViewport({ width: 450, height: 1000, deviceScaleFactor: 2 });
        
        console.log('Acessando a página...');
        // Create temp HTML with relative paths
        const htmlPath = path.join(__dirname, 'index.html');
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');
        htmlContent = htmlContent.replace(/href="\/src\/style.css"/g, 'href="./src/style.css"');
        htmlContent = htmlContent.replace(/src="\//g, 'src="./'); // Fix image paths
        
        const tempHtmlPath = path.join(__dirname, 'temp_screenshot.html');
        fs.writeFileSync(tempHtmlPath, htmlContent);

        console.log('Acessando a página...');
        await page.goto('file:///' + tempHtmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

        // Ocultar elementos que possam atrapalhar ou o fundo
        await page.evaluate(() => {
            document.body.style.background = '#0a0a1a';
            document.body.style.backgroundImage = 'radial-gradient(circle at 50% 50%, rgba(26, 31, 60, 1), #0a0a1a)';
            
            // Esconder o resto da página
            document.querySelectorAll('section, header, footer').forEach(el => {
                if (el.id !== 'depoimentos') {
                    el.style.display = 'none';
                }
            });

            // "Desmontar" o Swiper para que todos apareçam
            const swiperContainer = document.querySelector('.swiper');
            if(swiperContainer) {
                swiperContainer.style.overflow = 'visible';
                swiperContainer.style.position = 'static';
            }
            
            const swiperWrapper = document.querySelector('.swiper-wrapper');
            if(swiperWrapper) {
                swiperWrapper.style.display = 'block';
                swiperWrapper.style.transform = 'none';
            }

            document.querySelectorAll('.swiper-slide').forEach(slide => {
                slide.style.display = 'block';
                slide.style.opacity = '1';
                slide.style.position = 'static';
                slide.style.margin = '50px auto';
                slide.style.visibility = 'visible';
            });

            // Ajustar o background do card
            document.querySelectorAll('.wa-testimonial-card').forEach(card => {
                card.style.background = 'var(--glass)'; // força o estilo caso precise
            });
        });

        const cards = await page.$$('.wa-testimonial-card');
        console.log(`Encontrados ${cards.length} depoimentos visíveis.`);

        for (let i = 0; i < cards.length; i++) {
            const wrapper = cards[i];
            
            // Get the name of the user from the card for the filename
            let name = `Usuario_${i+1}`;
            try {
                name = await wrapper.$eval('h4', el => el.innerText.trim());
            } catch (e) {}
            
            // Clean filename
            const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const filePath = path.join(outDir, `depoimento_${safeName}.png`);

            // Scroll to the element to ensure it's visible
            await wrapper.scrollIntoView();
            // Wait a tiny bit for any animations/scroll
            await new Promise(r => setTimeout(r, 100));

            await wrapper.screenshot({ path: filePath });
            console.log(`Salvo: ${filePath}`);
        }

        await browser.close();
        console.log('Concluído!');
    } catch (err) {
        console.error('Erro:', err);
    } finally {
        fs.unlinkSync(tempHtmlPath);
        process.exit(0);
    }
}, 1000);
