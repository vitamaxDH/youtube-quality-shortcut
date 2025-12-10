interface KeyBinding {
    key: string;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    display: string;
}

interface UserSettings {
    bindings: {
        decreaseQuality: KeyBinding | null;
        increaseQuality: KeyBinding | null;
        lowestQuality: KeyBinding | null;
        highestQuality: KeyBinding | null;
    }
}

const DEFAULT_SETTINGS: UserSettings = {
    bindings: {
        decreaseQuality: null, // Default behavior relies on manifest/hardcoded logic
        increaseQuality: null,
        lowestQuality: null,
        highestQuality: null
    }
};

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();

    // Attach event listeners
    document.getElementById('saveBtn')?.addEventListener('click', saveSettings);
    document.getElementById('resetBtn')?.addEventListener('click', resetSettings);

    // Attach input recorders
    const inputs = document.querySelectorAll('.shortcut-input');
    inputs.forEach(input => {
        input.addEventListener('keydown', handleKeyRecording as EventListener);
        input.addEventListener('focus', (e) => (e.target as HTMLInputElement).value = 'Recording...');
        input.addEventListener('blur', (e) => {
            const el = e.target as HTMLInputElement;
            if (el.value === 'Recording...') loadSettings(); // Revert if cancelled
        });
    });
});

function handleKeyRecording(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    // Ignore standalone modifier keys
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    const binding: KeyBinding = {
        key: e.code,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
        display: formatShortcut(e)
    };

    const input = e.target as HTMLInputElement;
    input.value = binding.display;
    input.dataset.binding = JSON.stringify(binding);
    input.blur();
}

function formatShortcut(e: KeyboardEvent | KeyBinding): string {
    const parts = [];
    if (e.metaKey) parts.push('Cmd');
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    // Clean up key names
    let key = (e instanceof KeyboardEvent ? e.key : e.key).toUpperCase();
    if (key === ' ') key = 'Space';
    // Use code for consistency if handling event, but for display we usually want key
    // For KeyBinding obj, we stored 'code' in .key property, but we might want to map commonly used codes
    if (typeof e !== 'object' || !('key' in e)) return ''; // Safety

    // If it's the stored binding object, we stored e.code in .key. 
    // This is a simplification. For robust display we might need a map.
    // For now, let's just display the code stripped of 'Key'/'Digit' prefix
    if (!(e instanceof KeyboardEvent)) {
        key = e.key.replace('Key', '').replace('Digit', '');
    }

    parts.push(key);
    return parts.join(' + ');
}

async function loadSettings() {
    chrome.storage.sync.get(['bindings'], (result) => {
        const bindings = result.bindings || DEFAULT_SETTINGS.bindings;

        updateInput('decreaseQuality', bindings.decreaseQuality);
        updateInput('increaseQuality', bindings.increaseQuality);
        updateInput('lowestQuality', bindings.lowestQuality);
        updateInput('highestQuality', bindings.highestQuality);
    });
}

function updateInput(id: string, binding: KeyBinding | null) {
    const input = document.getElementById(id) as HTMLInputElement;
    if (binding) {
        input.value = binding.display;
        input.dataset.binding = JSON.stringify(binding);
    } else {
        input.value = 'Default';
        input.dataset.binding = '';
    }
}

function saveSettings() {
    const bindings = {
        decreaseQuality: getBindingFromInput('decreaseQuality'),
        increaseQuality: getBindingFromInput('increaseQuality'),
        lowestQuality: getBindingFromInput('lowestQuality'),
        highestQuality: getBindingFromInput('highestQuality')
    };

    chrome.storage.sync.set({ bindings }, () => {
        showStatus('Settings Saved!');
    });
}

function resetSettings() {
    chrome.storage.sync.remove('bindings', () => {
        loadSettings();
        showStatus('Reset to Defaults');
    });
}

function getBindingFromInput(id: string): KeyBinding | null {
    const input = document.getElementById(id) as HTMLInputElement;
    const data = input.dataset.binding;
    return data ? JSON.parse(data) : null;
}

function showStatus(msg: string) {
    const status = document.getElementById('status');
    if (status) {
        status.textContent = msg;
        status.classList.add('visible');
        setTimeout(() => status.classList.remove('visible'), 2000);
    }
}
