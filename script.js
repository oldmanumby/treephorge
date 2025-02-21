document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('input');
    const output = document.getElementById('output');
    const copyBtn = document.getElementById('copy');
    const exportBtn = document.getElementById('export');
    const darkModeToggle = document.getElementById('darkMode');
    const preserveNumberingToggle = document.getElementById('preserveNumbering');
    const showFolderSlashToggle = document.getElementById('showFolderSlash');
    const connectedRootsToggle = document.getElementById('connectedRoots');
    const showFolderIconsToggle = document.getElementById('showFolderIcons');
    const showFileIconsToggle = document.getElementById('showFileIcons');
    const useUpperCaseToggle = document.getElementById('useUpperCase');
    const includeCommentsToggle = document.getElementById('includeComments');
    const spaceReplacementRadios = document.getElementsByName('spaceReplacement');
    const fileFormatRadios = document.getElementsByName('fileFormat');

    // Initialize dark mode from localStorage
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        darkModeToggle.checked = true;
    }

    // Initialize settings from localStorage or defaults
    const settings = {
        // Theme section - ON by default
        darkMode: localStorage.getItem('darkMode') !== 'false',
        preserveNumbering: localStorage.getItem('preserveNumbering') !== 'false',
        showFolderSlash: localStorage.getItem('showFolderSlash') !== 'false',
        connectedRoots: localStorage.getItem('connectedRoots') !== 'false',
        includeComments: localStorage.getItem('includeComments') !== 'false',
        
        // Display section - OFF by default
        showFolderIcons: localStorage.getItem('showFolderIcons') === 'true',
        showFileIcons: localStorage.getItem('showFileIcons') === 'true',
        useUpperCase: localStorage.getItem('useUpperCase') === 'true',
        
        spaceReplacement: localStorage.getItem('spaceReplacement') || 'none',
        fileFormat: localStorage.getItem('fileFormat') || 'txt'
    };

    // Update UI to match settings
    darkModeToggle.checked = settings.darkMode;
    showFolderIconsToggle.checked = settings.showFolderIcons;
    showFileIconsToggle.checked = settings.showFileIcons;
    connectedRootsToggle.checked = settings.connectedRoots;
    preserveNumberingToggle.checked = settings.preserveNumbering;
    showFolderSlashToggle.checked = settings.showFolderSlash;
    useUpperCaseToggle.checked = settings.useUpperCase;
    includeCommentsToggle.checked = settings.includeComments;

    // Apply dark mode if enabled
    if (settings.darkMode) {
        document.body.classList.add('dark-mode');
    }

    // Icons (using simple ASCII characters)
    const ICONS = {
        folder: '📁 ',
        file: '📄 '
    };

    function processLines(lines, settings) {
        let result = '';
        const indentSize = 2;
        
        // First pass: find the maximum length of the tree structure (excluding comments)
        let maxLength = 0;
        const processedLines = [];
        const normalizedLines = normalizeIndentation(lines);
        
        normalizedLines.forEach((line, index) => {
            const level = (line.match(/^\s*/)[0].length) / 2;
            let [name, comment] = line.trim().split('#').map(s => s.trim());
            const isFolder = index < normalizedLines.length - 1 &&
                (normalizedLines[index + 1].match(/^\s*/)[0].length) / 2 > level;
            
            // Transform name based on settings
            let displayName = name;
            if (!settings.preserveNumbering) {
                // Handle both numbered (1., 2.) and lettered (a., b.) ordering
                displayName = displayName.replace(/^(?:\d+|[a-zA-Z])\.\s+/, '');
            }
            if (settings.spaceReplacement !== 'none') {
                if (settings.spaceReplacement === 'remove') {
                    displayName = displayName.replace(/\s+/g, '');
                } else {
                    const replacement = settings.spaceReplacement === 'underscore' ? '_' : '-';
                    displayName = displayName.replace(/\s+/g, replacement);
                }
            }
            if (settings.useUpperCase) {
                displayName = displayName.toUpperCase();
            }
            
            // Calculate prefix length
            const prefixLength = 4 * level; // Each level adds 4 characters (│   or    )
            const iconLength = isFolder ? 
                (settings.showFolderIcons ? ICONS.folder.length : 0) : 
                (settings.showFileIcons ? ICONS.file.length : 0);
            const nameLength = iconLength + displayName.length + (isFolder && !comment && settings.showFolderSlash ? 1 : 0);
            const totalLength = prefixLength + nameLength;
            maxLength = Math.max(maxLength, totalLength);
            
            processedLines.push({
                level,
                name,
                displayName,
                comment,
                isFolder
            });
        });
        
        // Add padding for comments
        const commentPadding = 4;
        
        // Find root items to help determine tree boundaries
        const rootIndices = processedLines
            .map((item, index) => item.level === 1 ? index : -1)
            .filter(index => index !== -1);
        
        // Second pass: generate the tree with aligned comments
        processedLines.forEach((item, index) => {
            const { level, displayName, comment, isFolder } = item;
            
            // If it's a root level item (level 1) and not the first one
            if (level === 1 && index > 0 && !settings.connectedRoots) {
                // Don't add extra newline
            }
            
            let prefix = '';
            
            // Track parent levels
            let parentLevels = new Set();
            let currentLevel = level;
            let currentIndex = index;
            
            // Find the current root's boundary
            let currentRootIndex = rootIndices.find(rootIndex => rootIndex <= index);
            let nextRootIndex = rootIndices.find(rootIndex => rootIndex > index) ?? processedLines.length;
            
            while (currentLevel > 1) {
                for (let i = currentIndex - 1; i >= 0; i--) {
                    if (!processedLines[i]) continue;
                    if (processedLines[i].level < currentLevel) {
                        parentLevels.add(processedLines[i].level);
                        currentLevel = processedLines[i].level;
                        currentIndex = i;
                        break;
                    }
                }
            }
            
            // If it's a root level item
            if (level === 1) {
                prefix = '';
            } else {
                for (let i = 1; i <= level; i++) {
                    if (i === level) {
                        const nextSibling = findNextAtLevel(normalizedLines, index, level);
                        // Only show sibling connector if it's before the next root
                        const showSibling = nextSibling !== -1 && 
                            (!settings.connectedRoots ? nextSibling < nextRootIndex : true);
                        prefix += showSibling ? '├── ' : '└── ';
                    } else {
                        let showLine = false;
                        if (parentLevels.has(i)) {
                            const nextAtLevel = findNextAtLevel(normalizedLines, index, i);
                            // Only show vertical line if it's before the next root
                            showLine = nextAtLevel !== -1 && 
                                (!settings.connectedRoots ? nextAtLevel < nextRootIndex : true);
                        }
                        prefix += showLine ? '│   ' : '    ';
                    }
                }
            }
            
            // Build the line with aligned comments
            let line = prefix;
            
            // Add appropriate icon
            if (isFolder && settings.showFolderIcons) {
                line += ICONS.folder;
            } else if (!isFolder && settings.showFileIcons) {
                line += ICONS.file;
            }
            
            line += displayName;
            
            if (comment) {
                const padding = maxLength - (prefix.length + displayName.length + 
                    (isFolder && settings.showFolderIcons ? ICONS.folder.length : 0) +
                    (!isFolder && settings.showFileIcons ? ICONS.file.length : 0)) + commentPadding;
                line += ' '.repeat(padding) + '# ' + comment;
            } else if (isFolder && settings.showFolderSlash) {
                line += '/';
            }
            
            result += line + '\n';
        });
        
        return result;
    }

    // Generate the tree when input changes
    function generateTree() {
        const lines = input.value.split('\n');
        output.textContent = processLines(lines, settings);
    }

    // Event Listeners
    input.addEventListener('input', generateTree);
    copyBtn.addEventListener('click', copyToClipboard);
    
    darkModeToggle.addEventListener('change', (e) => {
        settings.darkMode = e.target.checked;
        if (e.target.checked) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        localStorage.setItem('darkMode', e.target.checked);
    });

    preserveNumberingToggle.addEventListener('change', (e) => {
        console.log('Toggle changed:', e.target.checked);
        settings.preserveNumbering = e.target.checked;
        localStorage.setItem('preserveNumbering', e.target.checked);
        
        // Log current state
        console.log('Current input:', input.value);
        console.log('Is markdown?', detectMarkdown(input.value));
        console.log('Current settings:', settings);
        
        // Check if current input is markdown
        const inputText = input.value;
        if (detectMarkdown(inputText)) {
            console.log('Converting markdown...');
            const convertedText = convertMarkdownToTree(inputText);
            console.log('Converted text:', convertedText);
            input.value = convertedText;
        }
        
        console.log('Generating tree...');
        generateTree();
    });

    showFolderSlashToggle.addEventListener('change', (e) => {
        settings.showFolderSlash = e.target.checked;
        generateTree();
    });
    connectedRootsToggle.addEventListener('change', (e) => {
        settings.connectedRoots = e.target.checked;
        generateTree();
    });
    showFolderIconsToggle.addEventListener('change', (e) => {
        settings.showFolderIcons = e.target.checked;
        generateTree();
    });
    showFileIconsToggle.addEventListener('change', (e) => {
        settings.showFileIcons = e.target.checked;
        generateTree();
    });
    useUpperCaseToggle.addEventListener('change', (e) => {
        settings.useUpperCase = e.target.checked;
        generateTree();
    });
    spaceReplacementRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            settings.spaceReplacement = e.target.value;
            generateTree();
        });
    });

    fileFormatRadios.forEach(radio => {
        // Set initial state
        if (radio.value === settings.fileFormat) {
            radio.checked = true;
        }
        
        radio.addEventListener('change', (e) => {
            settings.fileFormat = e.target.value;
            localStorage.setItem('fileFormat', e.target.value);
        });
    });

    includeCommentsToggle.addEventListener('change', (e) => {
        settings.includeComments = e.target.checked;
        localStorage.setItem('includeComments', e.target.checked);
    });

    function findNextAtLevel(lines, startIndex, targetLevel) {
        for (let i = startIndex + 1; i < lines.length; i++) {
            const level = (lines[i].match(/^\s*/)[0].length) / 2;
            if (level < targetLevel) return -1;
            if (level === targetLevel) return i;
        }
        return -1;
    }

    function normalizeIndentation(lines) {
        const indentSize = 2;
        const result = [];
        const levelMap = new Map();
        
        lines.forEach((line, index) => {
            if (!line.trim()) return;
            
            const originalLevel = (line.match(/^\s*/)[0].length) / 2;
            let normalizedLevel;
            
            if (originalLevel === 0) {
                normalizedLevel = 1;
            } else {
                let parentLevel = -1;
                for (let i = index - 1; i >= 0; i--) {
                    if (!lines[i].trim()) continue;
                    const prevLevel = (lines[i].match(/^\s*/)[0].length) / 2;
                    if (prevLevel < originalLevel) {
                        parentLevel = prevLevel;
                        break;
                    }
                }
                
                if (parentLevel === -1) {
                    normalizedLevel = 1;
                } else {
                    const normalizedParentLevel = levelMap.get(parentLevel);
                    normalizedLevel = normalizedParentLevel + 1;
                }
            }
            
            levelMap.set(originalLevel, normalizedLevel);
            const spaces = ' '.repeat(normalizedLevel * indentSize);
            result.push(spaces + line.trim());
        });
        
        return result;
    }

    async function exportFiles() {
        const zip = new JSZip();
        const lines = normalizeIndentation(input.value.split('\n'));
        const stack = [{ path: '', folder: zip }];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            
            const level = (line.match(/^\s*/)[0].length) / 2;
            let [name, comment] = line.trim().split('#').map(s => s.trim());
            
            // Apply space replacement if needed
            if (settings.spaceReplacement !== 'none') {
                if (settings.spaceReplacement === 'remove') {
                    name = name.replace(/\s+/g, '');
                } else {
                    const replacement = settings.spaceReplacement === 'underscore' ? '_' : '-';
                    name = name.replace(/\s+/g, replacement);
                }
            }

            // Apply case transformation if needed
            if (settings.useUpperCase) {
                name = name.toUpperCase();
            }

            // Trim the stack to the current level's parent
            while (stack.length > level) {
                stack.pop();
            }

            const parentPath = stack[stack.length - 1].path;
            const fullPath = parentPath ? `${parentPath}/${name}` : name;

            // Check if this is a folder by looking at the next line's indentation
            const isFolder = i < lines.length - 1 && 
                           lines[i + 1].trim() && 
                           (lines[i + 1].match(/^\s*/)[0].length) / 2 > level;

            if (isFolder) {
                // Create folder
                const newFolder = zip.folder(fullPath);
                stack.push({ path: fullPath, folder: newFolder });
                
                // If folder has a comment and comments are enabled, create a comment file inside it
                if (comment && settings.includeComments) {
                    const commentFileName = name + '_comments.txt';
                    newFolder.file(commentFileName, comment);
                }
            } else {
                // Handle file extension based on settings
                let fileName = name;
                const hasExtension = /\.[^/.]+$/.test(name);
                const selectedFormat = settings.fileFormat || 'txt';
                
                if (hasExtension) {
                    // Keep original extension only if 'keep' is selected
                    fileName = selectedFormat === 'keep' ? name : `${name.split('.')[0]}.${selectedFormat}`;
                } else {
                    // No extension - use the selected format
                    fileName = `${name}.${selectedFormat}`;
                }
                
                // Create empty file with appropriate content based on file type
                let content = '';
                const ext = fileName.split('.').pop().toLowerCase();
                
                switch (ext) {
                    case 'html':
                        content = '<!DOCTYPE html>\n<html>\n<head>\n    <title>' + name + '</title>\n</head>\n<body>\n\n</body>\n</html>';
                        break;
                    case 'md':
                        content = '# ' + name + '\n';
                        break;
                    default:
                        content = '';
                        break;
                }

                // Use the parent folder to create the file
                const parentFolder = stack[stack.length - 1].folder;
                parentFolder.file(fileName, content, { binary: false });
                
                // If file has a comment and comments are enabled, create a comment file next to it
                if (comment && settings.includeComments) {
                    // Get the name without extension for the comment file
                    const baseName = name.split('.')[0];
                    const commentFileName = baseName + '_comments.txt';
                    parentFolder.file(commentFileName, comment, { binary: false });
                }
            }
        }

        try {
            const content = await zip.generateAsync({ 
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: {
                    level: 9
                }
            });
            const url = window.URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'tree-export.zip';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error creating zip file:', error);
            alert('Error creating zip file. Please try again.');
        }
    }

    exportBtn.addEventListener('click', exportFiles);

    function copyToClipboard() {
        const textArea = document.createElement('textarea');
        textArea.value = output.textContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = 'Copy to Clipboard';
        }, 2000);
    }

    function detectMarkdown(text) {
        const markdownPatterns = [
            /^#{1,6}\s+.+$/m,  // Headers
            /^[-*+]\s+.+$/m,   // Unordered lists
            /^\d+\.\s+.+$/m    // Ordered lists
        ];
        return markdownPatterns.some(pattern => pattern.test(text));
    }

    function removeNumbering(text) {
        // Remove leading numbers from the format "1. " or "1) "
        return text.replace(/^\d+[\.\)]\s+/, '');
    }

    function convertMarkdownToTree(markdown) {
        const lines = markdown.split('\n');
        let result = [];
        let currentHeaderLevel = 0;
        let lastHeaderIndent = 0;

        lines.forEach((line, index) => {
            line = line.trim();
            if (!line) return;

            // Handle headers (# Root, ## Folder, etc.)
            const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
            if (headerMatch) {
                currentHeaderLevel = headerMatch[1].length - 1;
                lastHeaderIndent = currentHeaderLevel * 2;
                
                // Check if header starts with a number
                const headerContent = headerMatch[2];
                const numberedHeaderMatch = headerContent.match(/^(\d+\.\s*)(.+)$/);
                
                let finalContent;
                if (numberedHeaderMatch) {
                    console.log('Found numbered header:', headerContent);
                    console.log('Preserve numbering setting:', settings.preserveNumbering);
                    finalContent = settings.preserveNumbering ? 
                        numberedHeaderMatch[1] + numberedHeaderMatch[2] : 
                        numberedHeaderMatch[2];
                    console.log('Final content:', finalContent);
                } else {
                    finalContent = headerContent;
                }
                
                result.push('  '.repeat(currentHeaderLevel) + finalContent);
                return;
            }

            // Handle list items
            const bulletMatch = line.match(/^[-*+]\s+(.+)$/);
            const numberMatch = line.match(/^(\d+\.\s+)(.+)$/);
            if (bulletMatch || numberMatch) {
                let content;
                if (numberMatch) {
                    console.log('Found numbered item:', line);
                    console.log('Preserve numbering setting:', settings.preserveNumbering);
                    content = settings.preserveNumbering ? 
                        numberMatch[1] + numberMatch[2] : 
                        numberMatch[2];
                    console.log('Final content:', content);
                } else {
                    content = bulletMatch[1];
                }
                
                const indent = lastHeaderIndent + 2;
                result.push('  '.repeat(indent / 2) + content);
            }
        });

        return result.join('\n');
    }

    // Handle paste events
    input.addEventListener('paste', (e) => {
        const pastedText = e.clipboardData.getData('text');
        
        if (detectMarkdown(pastedText)) {
            e.preventDefault();
            
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const currentValue = input.value;
            
            const convertedText = convertMarkdownToTree(pastedText);
            
            input.value = currentValue.substring(0, start) + 
                         convertedText + 
                         currentValue.substring(end);
            
            input.selectionStart = input.selectionEnd = start + convertedText.length;
            generateTree();
        }
    });

    // Handle Enter key for live markdown conversion
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const lines = input.value.split('\n');
            const currentLine = lines[lines.length - 1].trim();
            
            if (detectMarkdown(currentLine)) {
                e.preventDefault();
                
                // Convert just the current line
                const convertedLines = convertMarkdownToTree(currentLine);
                
                // Replace the current line and add a new line
                lines[lines.length - 1] = convertedLines;
                input.value = lines.join('\n') + '\n';
                
                // Move cursor to the new line
                input.selectionStart = input.selectionEnd = input.value.length;
                
                generateTree();
            }
        }
    });

    // Generate tree on initial load if there's content
    if (input.value) {
        generateTree();
    }
});
