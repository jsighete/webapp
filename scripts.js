// --- Constants ---
const DECAY_PER_HOUR = 100 / 24; // Loses 100% hydration over 24 hours
const DECAY_INTERVAL_MS = 5000; // Check and apply decay every 5 seconds
const MIN_HYDRATION = 0;
const MAX_HYDRATION = 100;
const DAILY_TASK_GOAL = 10; 

// --- Health State Machine ---
const HEALTH_STATES = [
    { 
        threshold: 20, // 0-19
        transform: 'rotate(10deg)', 
        colors: ['#D2B48C', '#A0522D', '#B18E66', '#FFDAB9'], 
        bg: ['#C68C5E', '#D3A588'] 
    },
    { 
        threshold: 50, // 20-49
        transform: 'rotate(5deg)',  
        colors: ['#B4CD6E', '#9ACD32', '#FFC107', '#FFD740'], 
        bg: ['#E0BE9D', '#EBD2BC'] 
    },
    { 
        threshold: 80, // 50-79
        transform: 'rotate(0deg)',   
        colors: ['#8BC34A', '#7CB342', '#FFC107', '#FFD740'], 
        bg: ['#A8D5B1', '#C6E7D2'] 
    },
    { 
        threshold: Infinity, // 80+
        transform: 'rotate(-5deg) scale(1.05)', 
        colors: ['#6EE7B7', '#5BB76E', '#FFD700', '#FFEA00'], 
        bg: ['#8BC34A', '#A1E6CA'] 
    }
];

// --- Global Plant State ---
const plant = {
    hydration: 0,
    tasksCompletedToday: 0,
    streak: 0,
    dailyGoalMet: false,
};

// --- DOM Element Cache ---
const hydrationBar = document.getElementById('hydration-bar');
const happinessBar = document.getElementById('happiness-bar');
const plantSvgGroup = document.getElementById('plant-svg-group');
const plantLeaves = document.querySelectorAll('#plant-leaves path');
const plantStem = document.getElementById('plant-stem');
const plantFlowerCenter = document.querySelector('#plant-flower circle:first-child');
const plantFlowerPetals = document.querySelectorAll('#plant-flower circle:not(:first-child)');
const statusMessage = document.getElementById('status-message');
const taskInput = document.getElementById('task-input');
const completeTaskButton = document.getElementById('complete-task-button');
const streakCounter = document.getElementById('streak-counter');
const bodyElement = document.body;
const dropletContainer = document.getElementById('droplet-container'); // [CHANGED]


// --- Core Functions ---

/**
 * Loads all data from localStorage, calculates offline decay, and handles daily resets.
 */
function loadData() {
    const data = JSON.parse(localStorage.getItem('plantData')) || {};
    const todayStr = new Date().toLocaleDateString();
    
    // --- 1. Load Streak ---
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString();

    if (data.lastCompletionDate === yesterdayStr) {
        plant.streak = data.streak || 0; // Continue streak
    } else if (data.lastCompletionDate === todayStr) {
        plant.streak = data.streak || 0; // Same day, streak already counted
    } else {
        plant.streak = 0; // Streak broken
    }

    // --- 2. Load Task State (Daily Reset) ---
    const lastSaveDate = data.lastSaveDate || new Date(0).toLocaleDateString();
    
    if (lastSaveDate === todayStr) {
        // Same day, load progress
        plant.tasksCompletedToday = data.tasksCompletedToday || 0;
        plant.dailyGoalMet = data.dailyGoalMet || false;
    } else {
        // New day, reset tasks
        plant.tasksCompletedToday = 0;
        plant.dailyGoalMet = false;
    }

    // --- 3. Load Hydration (Offline Decay) ---
    const savedHydration = data.hydration || 0;
    const savedTimestamp = data.hydrationTimestamp || Date.now();
    
    if (plant.dailyGoalMet) {
        // If goal was met, start the new day at 100
        plant.hydration = MAX_HYDRATION;
    } else {
        // Calculate decay since last save
        const elapsedMs = Date.now() - savedTimestamp;
        const elapsedHours = elapsedMs / (1000 * 60 * 60);
        const decayAmount = elapsedHours * DECAY_PER_HOUR;
        
        plant.hydration = Math.max(MIN_HYDRATION, savedHydration - decayAmount);
    }
}

/**
 * Saves all critical plant data to localStorage.
 */
function saveData(isGoalComplete = false) {
    const data = JSON.parse(localStorage.getItem('plantData')) || {};

    data.hydration = plant.hydration;
    data.hydrationTimestamp = Date.now();
    data.tasksCompletedToday = plant.tasksCompletedToday;
    data.dailyGoalMet = plant.dailyGoalMet;
    data.streak = plant.streak;
    data.lastSaveDate = new Date().toLocaleDateString();
    
    if (isGoalComplete) {
        data.lastCompletionDate = new Date().toLocaleDateString();
    }
    
    localStorage.setItem('plantData', JSON.stringify(data));
}

/**
 * Updates the ENTIRE UI based on the current plant state.
 */
function updateUI() {
    // 1. Update Hydration Bar
    const hydraPercent = (plant.hydration / MAX_HYDRATION) * 100;
    hydrationBar.style.width = `${hydraPercent}%`;
    hydrationBar.textContent = `${Math.round(plant.hydration)}%`;

    // 2. Update Task Bar
    const taskPercent = (plant.tasksCompletedToday / DAILY_TASK_GOAL) * 100;
    happinessBar.style.width = `${taskPercent}%`;
    happinessBar.textContent = `${plant.tasksCompletedToday} / ${DAILY_TASK_GOAL} Tasks`; 

    // 3. Update Streak Counter
    streakCounter.textContent = plant.streak;

    // 4. Update Plant Appearance
    const currentState = HEALTH_STATES.find(state => plant.hydration < state.threshold);

    if (currentState) {
        plantSvgGroup.style.transform = currentState.transform;
        setPlantColors(...currentState.colors);
        setBackgroundColors(...currentState.bg);
    }
}

// --- Helper Functions ---

/**
 * Sets the fill colors for various plant parts.
 */
function setPlantColors(leafColor, stemColor, flowerCenterColor, flowerPetalColor) {
    plantLeaves.forEach(leaf => {
        leaf.setAttribute('fill', leafColor);
    });
    plantStem.setAttribute('stroke', stemColor);
    plantFlowerCenter.setAttribute('fill', flowerCenterColor);
    plantFlowerPetals.forEach(petal => {
        petal.setAttribute('fill', flowerPetalColor);
    });
}

/**
 * Sets the background gradient colors via CSS variables.
 */
function setBackgroundColors(startColor, endColor) {
    bodyElement.style.setProperty('--bg-gradient-start', startColor);
    bodyElement.style.setProperty('--bg-gradient-end', endColor);
}


/**
 * Displays a temporary status message.
 */
function showStatusMessage(message) {
    if (statusMessage.timeoutId) {
        clearTimeout(statusMessage.timeoutId);
    }
    
    statusMessage.textContent = message;
    statusMessage.classList.remove('message-enter'); // Show message

    if (plant.dailyGoalMet) return; 

    statusMessage.timeoutId = setTimeout(() => {
        statusMessage.classList.add('message-enter'); // Start fade out
        
        setTimeout(() => {
            statusMessage.textContent = 'What task did you complete?';
            statusMessage.classList.remove('message-enter'); // Start fade in
        }, 500); // Must match CSS transition
    }, 2000); 
}

/**
 * Toggles the disabled state of the complete button.
 */
function setCompleteButtonDisabled(disabled) {
    if (completeTaskButton) {
        completeTaskButton.disabled = disabled;
    }
}

/**
 * Starts the "online" decay timer.
 */
function startDecayTimer() {
    setInterval(() => {
        if (plant.dailyGoalMet || plant.hydration <= MIN_HYDRATION) {
            return;
        }

        const decayAmount = (DECAY_PER_HOUR / 3600) * (DECAY_INTERVAL_MS / 1000);
        plant.hydration = Math.max(MIN_HYDRATION, plant.hydration - decayAmount);
        
        updateUI(); 
    }, DECAY_INTERVAL_MS);
}

/**
 * [CHANGED] Plays the watering animation
 */
function playDropletAnimation() {
    for (let i = 0; i < 5; i++) {
        const droplet = document.createElement('div');
        droplet.classList.add('droplet');
        
        // Random horizontal position (from 20% to 80% of the container width)
        droplet.style.left = `${Math.random() * 60 + 20}%`; 
        // Random animation delay
        droplet.style.animationDelay = `${Math.random() * 0.5}s`;
        
        dropletContainer.appendChild(droplet);
        
        // Remove the droplet after its animation finishes
        setTimeout(() => {
            droplet.remove();
        }, 1200); // Must match CSS animation duration
    }
}

// --- Event Listeners ---

taskInput.addEventListener('input', () => {
    if (plant.dailyGoalMet) return; 
    setCompleteButtonDisabled(taskInput.value.trim() === '');
});

completeTaskButton.addEventListener('click', () => {
    if (plant.dailyGoalMet) return; 

    const taskName = taskInput.value.trim();
    if (taskName === '') { 
        showStatusMessage("Please enter a task!");
        return;
    }

    plant.tasksCompletedToday++;

    if (plant.tasksCompletedToday === DAILY_TASK_GOAL) { 
        // --- GOAL MET ---
        plant.hydration = MAX_HYDRATION;
        plant.dailyGoalMet = true;
        plant.streak++;
        
        playDropletAnimation(); // [CHANGED] Play animation
        showStatusMessage(`Goal complete! Streak: ${plant.streak}`);
        setCompleteButtonDisabled(true);
        taskInput.disabled = true;
        taskInput.placeholder = "Come back tomorrow!";
        saveData(true); 
        
    } else {
        // --- TASK 1-9 ---
        const hydrationPerTask = MAX_HYDRATION / DAILY_TASK_GOAL; // 100 / 10 = 10
        plant.hydration = Math.min(MAX_HYDRATION, plant.hydration + hydrationPerTask);
        
        playDropletAnimation(); // [CHANGED] Play animation
        showStatusMessage(`Great job on: ${taskName}!`);
        saveData(false); 
    }

    updateUI();
    taskInput.value = '';
    setCompleteButtonDisabled(true);
});

window.addEventListener('beforeunload', () => {
    if (!plant.dailyGoalMet) {
        saveData(false);
    }
});

// --- Initial App Setup ---
// Run all startup functions
loadData(); 
updateUI(); 
startDecayTimer(); 

// Set initial enabled/disabled state for inputs
setCompleteButtonDisabled(true);
if (plant.dailyGoalMet) {
    taskInput.disabled = true;
    taskInput.placeholder = "Come back tomorrow!";
    setCompleteButtonDisabled(true);
}