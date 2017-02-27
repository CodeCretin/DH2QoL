// ==UserScript==
// @name		DH2QoL
// @namespace	https://greasyfork.org/
// @version		0.1.0
// @description	Quality of Life tweaks for Diamond Hunt 2
// @author		John / WhoIsYou
// @match		http://*.diamondhunt.co/game.php
// @match		https://*.diamondhunt.co/game.php
// @run-at document-idle
// @grant		none
// ==/UserScript==
'use strict';

/************
* CHANGELOG *
************/
/*
	v0.1.0 Feb 26 2017
	- Initial release
	- Timers formatted in the HH:MM:SS format, or MM:SS for shorter ones
    - Added timers for smelting and woodcutting plots
    - Added net oil gain/consumption indicator
    - Added oil timer (time until capacity full or empty)
    - Right clicking your bound furnace will attempt to repeat the last action
    - Right clicking a potion recipe will attempt to brew as many as possible
    - Right clicking raw food will attempt to cook all of it
    - Right clicking cooked food will attempt to eat all of it
    - Disabled ability to sell precious gems
*/

/* TO DO
	Settings
	Adventurer's Log (History of actions)
	Persistent furnace settings
	Username mentions / alerts (show full message?)
*/

const DH2_QOL_CONFIG = {
	formatTimers : {
		text : "Enable HH:MM:SS timer formatting?",
		value : true
	},
	customTimers : {
		text : "Enable custom timers?",
		value : true
	},
	disableLeftClickSellGems : {
		text : "Disable selling gems on left click?",
		value : true
	},
	enableRightClickFurnaceRepeat : {
		text : "Enable right clicking bound furnace to repeat last action?",
		value : true
	},
	enableRightClickBrewAllPotion : {
		text : "Enable right clicking to brew all of a potion type?",
		value : true
	},
	enableRightClickCookAllFood : {
		text : "Enable right clicking to cook food?",
		value : true
	},
	enableRightClickEatAllFood : {
		text : "Enable right clicking to eat food?",
		value : true
	}
};
const TREES = {
	"1" : {
		"id" : "1",
		"variable" : "tree",
		"name" : "Tree",
		"growTime" : 10800 // 3 hours
	},
	"2" : {
		"id" : "2",
		"variable" : "oakTree",
		"name" : "Oak Tree",
		"growTime" : 21600 // 6 hours
	},
	"3" : {
		"id" : "3",
		"variable" : "willowTree",
		"name" : "Willow Tree",
		"growTime" : 28800 // 8 hours
	}
};
const RAW_FOOD = ["uncookedBread", "uncookedCake", "rawChicken", "rawShrimp", "rawSardine", "rawTuna", "rawSwordfish", "rawShark", "rawWhale", "rawRainbowFish"];
const COOKED_FOOD = ["honey", "bread", "chicken", "shrimp", "sardine", "tuna", "swordfish", "shark", "whale", "rainbowFish"];

(function init(triesLeft) {

	// Thanks /u/TheZorbing
	if (triesLeft > 0 && (!window.hasOwnProperty("webSocket") || window.webSocket.readyState !== WebSocket.OPEN || window.firstLoadGame === true)) {
		setTimeout(() => {
			init(--triesLeft);
		}, 100);
		return;
	}

	console.log("Launching DH2-QoL. Welcome " + window.username);

	if (window.hasOwnProperty("webSocket") && window.webSocket.readyState === WebSocket.OPEN)
		// WebSocket proxy
		proxyWebSocketOnMessage();
	else
		console.log("WebSocket failed to load. Some functionality is unavailable. Try refreshing.");

	if (!window.firstLoadGame) {
		processDormantTabsOnLoad();
		enableRightClickFurnaceRepeat();
		enableRightClickBrewAllPotion();
		enableRightClickCookAllFood();
		enableRightClickEatAllFood();
		disableLeftClickSellGems();
		// Additional proxies
		proxyConfirmDialogue();
	} else {
		console.log("Script loaded before the game did. Some functionality may be missing. Lag? Try refreshing.");
	}

	return;
})(100);

/*
	Actions performed prior to any game tick
*/
function preGameTick() {

}

/*
	Actions performed following any game tick
*/
function postGameTick() {
	updateSmeltingTimer();
	updateWoodcuttingTimer();
	updateOilTimer();
}

function openSettings() {

}

function processDormantTabsOnLoad() {
	window.processBrewingTab();
}

function enableRightClickFurnaceRepeat() {
	let nodes = document.querySelectorAll("[onclick^=openFurnaceDialogue]");
	for (let k in nodes) {
		let node = nodes[k];
		if (node && node instanceof Node) {
			node.oncontextmenu = () => {
				let amt = document.getElementById("input-smelt-bars-amount").value;
				if (window.smeltingBarType == 0 && amt > 0 && window.selectedBar !== "none") {
					window.smelt(amt);
				}
				return false;
			};
		}
	}
}

function enableRightClickBrewAllPotion() {
	let keys = Object.keys(window.brewingRecipes);
	for (let k = 0; k < keys.length; k++) {
		let key = keys[k];
		if (key === "stardustCrystalPotion")
			continue;
		let recipe = window.brewingRecipes[key];
		let node = document.getElementById("brewing-" + key);
		if (node) {
			node.oncontextmenu = () => {
				let vials = window.vialOfWater;
				let total = vials;
				for (let i = 0; i < recipe.recipe.length; i++) {
					total = (total <= Math.floor(window[recipe.recipe[i]] / recipe.recipeCost[i])) ? total : Math.floor(window[recipe.recipe[i]] / recipe.recipeCost[i]);
				}
				if (total > 0)
					window.sendBytes(`BREW=${recipe.itemName}~${total}`);

				return false;
			};
		}
	}
}

function enableRightClickCookAllFood() {
	for (let k in RAW_FOOD) {
		let food = RAW_FOOD[k];
		let node = document.getElementById("item-box-" + food);
		if (node) {
			node.oncontextmenu = () => {
				window.cook(food, window[food]);
				return false;
			};
		}
	}
}

function enableRightClickEatAllFood() {
	for (let k in COOKED_FOOD) {
		let food = COOKED_FOOD[k];
		let node = document.getElementById("item-box-" + food);
		if (node) {
			node.oncontextmenu = () => {
				window.sendBytes(`CONSUME=${food}~${window[food]}`);
				return false;
			};
		}
	}
}

function disableLeftClickSellGems() {
	try {
		document.getElementById("item-box-sapphire").onclick = null;
		document.getElementById("item-box-emerald").onclick = null;
		document.getElementById("item-box-ruby").onclick = null;
		document.getElementById("item-box-diamond").onclick = null;
		document.getElementById("item-box-bloodDiamond").onclick = null;
	} catch (e) { console.log(e); }
}

/*****
*
* F U N C T I O N P R O X I E S
*
*****/

function proxyWebSocketOnMessage() {
	let proxy = window.webSocket.onmessage;
	window.webSocket.onmessage = function() {
		proxy.apply(this, arguments);
		postGameTick();
	};
}

function proxyConfirmDialogue() {
	let proxy = window.confirmDialogue;
	window.confirmDialogue = function(width, bodyText, buttonText1, buttonText2, sendBytes) {
		proxy.apply(this, arguments);
	};
}

/*****
*
* T I M E R S & F O R M A T I N G
*
*****/

/*
	Check if a string of text can be a URL
*/
function isLink(text) {
	return text.test(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig);
}

/*
	Make links clickable
*/
function linkify(text) {
	return text.replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, "<a href='$1' target='_blank'>$1</a>");
}

function padLeft(value, padChar, length) {
	value = value.toString(); padChar = padChar.toString();
	return value.length < length ? padLeft(padChar + value, padChar, length) : value;
}

/*
	Formats a time (in seconds) as hh:mm:ss or mm:ss if no hours
*/
function formatTime(secs) {
	let seconds = Math.round(secs % 60);
	let minutes = Math.floor((secs % 3600) / 60);
	let hours = Math.floor(secs / 3600);

	return `${hours > 0 ? padLeft(hours, 0, 2) + ":" : ""}${padLeft(minutes, 0, 2)}:${padLeft(seconds, 0, 2)}`;
}
/*
	Overwrite Diamond Hunt 2's native formatTime functions with our own to achieve nicely formatted timers with no hassle
*/
(function replaceDHNativeFormatTime() {
	window.formatTime = formatTime;
	window.formatTimeShort = formatTime;
	window.formatTimeShort2 = formatTime;
})();

/*
	Adds and updates a smelting timer
*/
function updateSmeltingTimer() {
	let node = document.getElementById("notif-smelting");
	if (node && node.children.length > 1)
		node.children[1].textContent = `${formatTime(window.smeltingPercD - window.smeltingPercN)}|${window.smeltingPerc}`;
}

/*
	Adds and updates a woodcutting timer
*/
function updateWoodcuttingTimer() {
	// Add and update woodcutting patch timers
	let node;
	for (let i = 1; i <= 6; i++) {
		if (i >= 5 && window.donorWoodcuttingPatch === 0)
			break;
		node = document.getElementById("wc-div-tree-" + i);
		if (node) {
			if (!document.getElementById("treeTimer" + i)) // Node doesn't exist so we'll create it
				node.innerHTML = "<span id='treeTimer" + i + "' style='color:blue'></span><br>" + node.innerHTML;
			if (window["treeId" + i] == 0) // The tree plot is empty
				document.getElementById("treeTimer" + i).textContent = "Waiting for tree to spawn...";
			else if (TREES[window["treeId" + i]].growTime - window["treeGrowTimer" + i] == 0) // Tree is fully grown
				document.getElementById("treeTimer" + i).textContent = `Ready To Harvest ${TREES[window["treeId" + i]].name}!`;
			else // A tree is growing
				document.getElementById("treeTimer" + i).textContent = TREES[window["treeId" + i]].name + ": " + formatTime(TREES[window["treeId" + i]].growTime - window["treeGrowTimer" + i]);
		}
	}
}

/*
	Adds and updates an oil timer & net oil consumption
*/
function updateOilTimer() {
	let oilFlowNode = document.getElementById("oil-flow-values");
 	let netConsumptionNode = document.getElementById("oilNetConsumption");
 	let oilTimerNode = document.getElementById("oilTimer");

 	if (oilFlowNode) {
		if (!netConsumptionNode)
			oilFlowNode.innerHTML += "<span id='oilNetConsumption' style='color:yellow'></span>";
		else
			netConsumptionNode.textContent = ` (${getNetOilConsumption() > 0 ? "+" + getNetOilConsumption() : getNetOilConsumption()})`;
		if (!oilTimerNode)
			oilFlowNode.innerHTML += "<span id='oilTimer' style='color: orange'></span>";
		else
			oilTimerNode.textContent = ` (${(getNetOilConsumption() > 0) ? formatTime((getOilCapacity() - getCurrentOil()) / getNetOilConsumption()) : formatTime(getCurrentOil() / getNetOilConsumption())})`;
	}
}

function getOilCapacity() {
	return window.maxOil;
}

function getCurrentOil() {
	return window.oil;
}

function getNetOilConsumption() {
	return window.oilIn - window.oilOut;
}
