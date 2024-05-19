// script.js

document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const passwordPrompt = document.getElementById('passwordPrompt');
    const passwordInput = document.getElementById('passwordInput');
    const setPasswordButton = document.getElementById('setPasswordButton');
    const shareLinkPrompt = document.getElementById('shareLinkPrompt');
    const shareLink = document.getElementById('shareLink');
    const copyLinkButton = document.getElementById('copyLinkButton');
    let selectedFile;

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');

        const file = e.dataTransfer.files[0];
        if (file) {
            selectedFile = file;
            showPasswordPrompt();
        }
    });

    setPasswordButton.addEventListener('click', async () => {
        const password = passwordInput.value;
        if (password) {
            const encryptedFile = await encryptFile(selectedFile, password);
            setupP2PConnection(encryptedFile, password);
            showShareLinkPrompt();
        }
    });

    copyLinkButton.addEventListener('click', () => {
        shareLink.select();
        document.execCommand('copy');
        alert('Link copied to clipboard');
    });

    function showPasswordPrompt() {
        passwordPrompt.classList.remove('hidden');
    }

    function showShareLinkPrompt() {
        passwordPrompt.classList.add('hidden');
        shareLinkPrompt.classList.remove('hidden');
        shareLink.value = generateShareLink();
    }

    function generateShareLink() {
        return `${window.location.href}?fileId=${Date.now()}`;
    }

    async function encryptFile(file, password) {
        const fileArrayBuffer = await file.arrayBuffer();
        const keyMaterial = await getKeyMaterial(password);
        const key = await getKey(keyMaterial);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedContent = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            fileArrayBuffer
        );

        const encryptedFile = new Blob([iv, new Uint8Array(encryptedContent)], { type: file.type });
        return encryptedFile;
    }

    async function getKeyMaterial(password) {
        const enc = new TextEncoder();
        return crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
    }

    async function getKey(keyMaterial) {
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: new Uint8Array(16),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    }

    function setupP2PConnection(file, password) {
        const peer = new SimplePeer({ initiator: true, trickle: false });

        peer.on('signal', data => {
            shareLink.value = `${window.location.href}?fileId=${Date.now()}&signal=${btoa(JSON.stringify(data))}`;
        });

        peer.on('connect', () => {
            console.log('P2P connection established');
            peer.send(file);
        });

        peer.on('data', data => {
            const decryptedFile = decryptFile(data, password);
            console.log('Received:', decryptedFile);
        });

        peer.on('close', () => {
            console.log('P2P connection closed');
        });

        const urlParams = new URLSearchParams(window.location.search);
        const signal = urlParams.get('signal');

        if (signal) {
            peer.signal(JSON.parse(atob(signal)));
        }
    }

    async function decryptFile(encryptedFile, password) {
        const keyMaterial = await getKeyMaterial(password);
        const key = await getKey(keyMaterial);
        const iv = encryptedFile.slice(0, 12);
        const data = encryptedFile.slice(12);
        const decryptedContent = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        );
        return new Blob([decryptedContent], { type: 'application/octet-stream' });
    }
});
