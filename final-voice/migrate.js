const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function migrateDir(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            migrateDir(fullPath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            const isTsx = file.endsWith('.tsx');
            const targetFile = fullPath.replace(/\.tsx?$|\.ts?$/, isTsx ? '.jsx' : '.js');
            console.log(`Processing: ${fullPath} -> ${targetFile}`);

            try {
                // Run detype
                execSync(`npx -y detype "${fullPath}" "${targetFile}"`, { stdio: 'inherit' });

                // Delete the original
                fs.unlinkSync(fullPath);

                // Update imports within the generated file
                let content = fs.readFileSync(targetFile, 'utf8');
                // Replace any .tsx or .ts imports with .jsx or .js
                content = content.replace(/\.tsx(['"])/g, '.jsx$1');
                content = content.replace(/\.ts(['"])/g, '.js$1');
                fs.writeFileSync(targetFile, content);
            } catch (err) {
                console.error(`Error processing ${fullPath}`, err);
            }
        }
    }
}

migrateDir(path.join(__dirname, 'src'));
console.log('Migration complete!');
