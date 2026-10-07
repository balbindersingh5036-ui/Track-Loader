const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

function findAndReplace(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            findAndReplace(fullPath);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let newContent = content
                .replace(/colors\.navy/g, 'colors.text')
                .replace(/colors\.inkSecondary/g, 'colors.textMuted')
                .replace(/colors\.ink/g, 'colors.textLight')
                .replace(/colors\.canvas/g, 'colors.background')
                .replace(/colors\.surfaceSubtle/g, 'colors.surface')
                .replace(/colors\.mutedLight/g, 'colors.textLight')
                .replace(/colors\.muted/g, 'colors.textMuted')
                .replace(/colors\.primaryLight/g, 'colors.surfaceAlt');
                
            if (content !== newContent) {
                fs.writeFileSync(fullPath, newContent, 'utf8');
                console.log(`Updated ${fullPath}`);
            }
        }
    });
}

findAndReplace(directoryPath);
console.log("Color replacement complete.");
