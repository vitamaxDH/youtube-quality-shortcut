
import esbuild from 'esbuild';
import fs from 'fs-extra';
import path from 'path';
import AdmZip from 'adm-zip';

const DIST_DIR = 'dist';
const OUTPUT_DIR = 'output';

async function build() {
    console.log('Cleaning dist directory...');
    fs.removeSync(DIST_DIR);
    fs.ensureDirSync(DIST_DIR);

    console.log('Building TypeScript files...');
    await esbuild.build({
        entryPoints: [
            'src/content.ts',
            'src/popup.ts',
            'src/control.ts',
            'src/service-worker.ts',
            'src/check_os.ts',
            'src/options.ts'
        ],
        bundle: true,
        outdir: DIST_DIR,
        minify: true,
        platform: 'browser',
        target: 'es2020',
        sourcemap: false,
    });

    const isProd = process.argv.includes('--prod');
    console.log('Copying assets...');

    // Handle popup.html specially for production
    if (isProd) {
        console.log('Production build: Removing debug logs...');
        let popupContent = fs.readFileSync('popup.html', 'utf-8');
        // Remove the debug section using regex or string replacement
        // Assuming debug-section is the class name
        popupContent = popupContent.replace(/<div class="debug-section"[\s\S]*?<\/div>\s*<\/main>/, '</main>');
        fs.writeFileSync(path.join(DIST_DIR, 'popup.html'), popupContent);
    } else {
        fs.copySync('popup.html', path.join(DIST_DIR, 'popup.html'));
    }
    fs.copySync('manifest.json', path.join(DIST_DIR, 'manifest.json'));
    if (fs.existsSync('images')) {
        fs.copySync('images', path.join(DIST_DIR, 'images'));
    }
    // Copy css files
    const cssFiles = fs.readdirSync('.').filter(file => file.endsWith('.css'));
    for (const file of cssFiles) {
        fs.copySync(file, path.join(DIST_DIR, file));
    }

    // Create zip for distribution
    const packageJson = fs.readJsonSync('package.json');
    const version = packageJson.version;
    const zipName = `v${version}.zip`;

    fs.ensureDirSync(OUTPUT_DIR);
    const zip = new AdmZip();
    zip.addLocalFolder(DIST_DIR);
    zip.writeZip(path.join(OUTPUT_DIR, zipName));

    console.log(`✅ Successfully created: ${OUTPUT_DIR}/${zipName}`);
    console.log(`📁 Extension files available in: ${DIST_DIR}/`);
}

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
