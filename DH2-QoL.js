// ==UserScript==
// @name		DH2QoL
// @namespace	https://greasyfork.org/
// @version		0.1.1
// @description	Quality of Life tweaks for Diamond Hunt 2
// @author		John / WhoIsYou / CodeCretin
// @match		http://*.diamondhunt.co/game.php
// @match		https://*.diamondhunt.co/game.php
// @run-at document-idle
// @grant		none
// ==/UserScript==
'use strict';

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
		// Interface delight
		updateStyleSheets();
		addNotificationElements();
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
	updateNotificationElements();
	updateSmeltingTimer();
	updateWoodcuttingTimer();
	updateOilTimer();
}

function openSettings() {

}

function processDormantTabsOnLoad() {
	window.processBrewingTab();
}

function updateStyleSheets() {
	for (let i = 0; i < document.styleSheets.length; i++) {
		if (document.styleSheets[i].href.indexOf("game-main-style.css") !== -1) {
			// game-main-style.css
			let styleSheet = document.styleSheets[i];
			if (styleSheet.cssRules) {

				for (let k in styleSheet.cssRules) {
					let cssRule = styleSheet.cssRules[k];
					if (cssRule.selectorText && cssRule.selectorText.indexOf("span.notif-box") !== -1) {
						styleSheet.deleteRule(k); // Delete the original span.notif-box rule
						styleSheet.insertRule(`span.notif-box
							{
								display:inline-block;
								margin:5px 5px 5px 0px;
								color:white;
								border:1px solid silver;
								padding:5px 10px;
								font-size:12pt;
								background: -webkit-linear-gradient(#801A00, #C15033); /* For Safari 5.1 to 6.0 */
								background: -o-linear-gradient(#801A00, #C15033); /* For Opera 11.1 to 12.0 */
								background: -moz-linear-gradient(#801A00, #C15033); /* For Firefox 3.6 to 15 */
								background: linear-gradient(#801A00, #C15033); /* Standard syntax */
							}`, 0);
						styleSheet.insertRule(`span.dhqol-notif-ready
							{
								display:inline-block;
								margin:5px 5px 5px 0px;
								color:white;
								border:1px solid silver;
								padding:5px 5px;
								font-size:12pt;
								cursor:pointer;
								background: -webkit-linear-gradient(#801A00, #C15033);
								background: -o-linear-gradient(#801A00, #C15033);
								background: -moz-linear-gradient(#801A00, #C15033);
								background: linear-gradient(#161618, #48ab32);
							}`, 0);
					}
				}
			}
			break;
		}
	}
}

function addNotificationElements() {
	const SPAN = document.createElement("span");
	SPAN.className = "dhqol-notif-ready";
	SPAN.style = "display:inline-block"
	SPAN.appendChild(document.createElement("img"));
	SPAN.children[0].className = "image-icon-50";
	SPAN.appendChild(document.createElement("span"));

	let notificationNode = document.getElementById("notifaction-area");
	let refNode = notificationNode.children[0] || null;

	// Create our new notification span elements
	let furnaceElement = SPAN.cloneNode(true);
	furnaceElement.id = "dhqol-notif-furnace";
	furnaceElement.children[0].setAttribute("src", "images/silverFurnace.png");
	let woodCuttingElement = SPAN.cloneNode(true);
	woodCuttingElement.id = "dhqol-notif-woodcutting";
	woodCuttingElement.children[0].setAttribute("src", "images/icons/woodcutting.png");
	let farmingElement = SPAN.cloneNode(true);
	farmingElement.id = "dhqol-notif-farming";
	farmingElement.children[0].setAttribute("src", "images/icons/watering-can.png");
	let combatElement = SPAN.cloneNode(true);
	combatElement.id = "dhqol-notif-combat";
	combatElement.children[0].setAttribute("src", "images/icons/combat.png");
	let rowBoatElement = SPAN.cloneNode(true);
	rowBoatElement.id = "dhqol-notif-rowboat";
	rowBoatElement.children[0].setAttribute("src", "images/rowBoat.png");
	rowBoatElement.setAttribute("onclick", "window.clicksBoat('rowBoat')");
	let canoeElement = SPAN.cloneNode(true);
	canoeElement.id = "dhqol-notif-canoe";
	canoeElement.children[0].setAttribute("src", "images/canoe.png");
	canoeElement.setAttribute("onclick", "window.clicksBoat('canoe')");

	// Insert our new elements into the document
	notificationNode.insertBefore(furnaceElement, refNode);
	notificationNode.insertBefore(woodCuttingElement, refNode);
	notificationNode.insertBefore(farmingElement, refNode);
	notificationNode.insertBefore(combatElement, refNode);
	notificationNode.insertBefore(rowBoatElement, refNode);
	notificationNode.insertBefore(canoeElement, refNode);
}

function updateNotificationElements() {
	// Hide native DH2 notifications
	let notificationIDs = ["notification-static-farming", "notification-static-woodcutting", "notification-static-combat", "notif-smelting", "notif-rowBoatTimer", "notif-canoeTimer"];
	for (let i = 0; i < notificationIDs.length; i++) {
		let node = document.getElementById(notificationIDs[i]);
		if (node) {
			node.style.display = "none";
		}
	}

	// Update DH2QoL Custom notifications based on gamestate
	let furnaceElement = document.getElementById("dhqol-notif-furnace");
	furnaceElement.style.display = window.craftingUnlocked == 1 ? "inline-block" : "none";
	if (window.smeltingBarType == 0) {
		furnaceElement.className = "dhqol-notif-ready";
		furnaceElement.children[0].setAttribute("src", "images/silverFurnace.png");
		furnaceElement.children[1].textContent = "";
		furnaceElement.onclick = function() {
			window.openTab("crafting");
			window.openFurnaceDialogue(getBoundFurnace());
		}
		furnaceElement.oncontextmenu = function() {
			furnaceRepeat();
			return false;
		}
	} else {
		furnaceElement.className = "notif-box";
		furnaceElement.children[0].setAttribute("src", `images/${window.getBarFromId(window.smeltingBarType)}.png`);
		furnaceElement.children[1].textContent = `${formatTime(Math.max(window.smeltingPercD - window.smeltingPercN, 0))} (${window.smeltingPerc}%)`;
		furnaceElement.setAttribute("onclick", "");
	}
	let woodCuttingElement = document.getElementById("dhqol-notif-woodcutting");
	woodCuttingElement.style.display = window.woodcuttingUnlocked == 1 ? "inline-block;" : "none";
	if (window.treeStage1 == 4 || window.treeStage2 == 4 || window.treeStage3 == 4 || window.treeStage4 == 4 || window.treeStage5 == 4 || window.treeStage6 == 4) {
		woodCuttingElement.className = "dhqol-notif-ready";
		woodCuttingElement.children[1].textContent = "";
		woodCuttingElement.setAttribute("onclick", "window.openTab('woodcutting')");
		woodCuttingElement.oncontextmenu = function() {
			harvestTrees();
			return false;
		}
	} else {
		let gt = getSoonestWoodcuttingTimer();
		woodCuttingElement.className = "notif-box";
		woodCuttingElement.children[1].textContent = gt === null ? "" : formatTime(gt);
		woodCuttingElement.setAttribute("onclick", "");
	}
	let farmingElement = document.getElementById("dhqol-notif-farming");
	farmingElement.style.display = window.farmingUnlocked == 1 ? "inline-block" : "none";
	if (window.farmingPatchStage1 == 0 || window.farmingPatchStage1 == 4 || window.farmingPatchStage2 == 0 || window.farmingPatchStage2 == 4
		|| window.farmingPatchStage3 == 0 || window.farmingPatchStage3 == 4 || window.farmingPatchStage4 == 0 || window.farmingPatchStage4 == 4
		|| (window.donorFarmingPatch != 0 && (window.farmingPatchStage5 == 0 || window.farmingPatchStage5 == 4 || window.farmingPatchStage6 == 0 || window.farmingPatchStage6 == 4))) {
			farmingElement.className = "dhqol-notif-ready";
			farmingElement.setAttribute("onclick", "openTab('farming')");
			farmingElement.children[1].textContent = "";
			farmingElement.oncontextmenu = function() {
				if (window.planter == 1) {
					window.openFarmingPatchDialogue(-1);
					return false;
				};
			}
		} else {
			farmingElement.className = "notif-box";
			farmingElement.setAttribute("onclick", "");
			farmingElement.children[1].textContent = formatTime(getBestFarmingTimer());
		}

	let combatElement = document.getElementById("dhqol-notif-combat");
	combatElement.style.display = window.combatUnlocked == 1 ? "inline-block" : "none";
	if (window.combatGlobalCooldown == 0) {
		combatElement.className = "dhqol-notif-ready";
		combatElement.children[1].innerHTML = '<img src="images/steak.png" style="" class="image-icon-15">' + parseInt(window.energy).toLocaleString("en-US");
		combatElement.setAttribute("onclick", "window.openTab('combat'); window.openFightMenu()");
	} else {
		combatElement.className = "notif-box";
		combatElement.children[1].innerHTML = formatTime(window.combatGlobalCooldown);
		combatElement.setAttribute("onclick", "");
	}
	let rowBoatElement = document.getElementById("dhqol-notif-rowboat");
	rowBoatElement.style.display = window.boundRowBoat == 1 ? "inline-block" : "none";
	if (window.rowboatTimer == 0) {
		rowBoatElement.className = "dhqol-notif-ready";
		rowBoatElement.children[1].innerHTML = '<img class="image-icon-15" src="images/fishingBait.png">' + window.fishingBait;
	} else {
		rowBoatElement.className = "notif-box";
		rowBoatElement.children[1].innerHTML = formatTime(window.rowBoatTimer);
	}
	let canoeElement = document.getElementById("dhqol-notif-canoe");
	canoeElement.style.display = window.boundCanoe == 1 ? "inline-block" : "none";
	if (window.canoeTimer == 0) {
		canoeElement.className = "dhqol-notif-ready";
		canoeElement.children[1].innerHTML = '<img class="image-icon-15" src="images/fishingBait.png">' + window.fishingBait;
	} else {
		canoeElement.className = "notif-box";
		canoeElement.children[1].innerHTML = formatTime(window.canoeTimer);
	}
}

function ctrlClickRecipeToHide() {
	let nodes = document.querySelectorAll("[id^=crafting-]");

}

function harvestTrees() {
	for (let i = 1; i <= 6; i++) {
		if (window["treeStage" + i] == 4) {
			setTimeout(() => {
				sendBytes("CHOP_TREE=" + i);
			}, i * 25);
		}
	}
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

function furnaceRepeat() {
	let amt = document.getElementById("input-smelt-bars-amount").value;
	if (window.smeltingBarType == 0 && amt > 0 && window.selectedBar !== "none") {
		window.smelt(amt);
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

function ebaleRightClickOpenAllLoot() {
	let nodes = document.querySelectorAll("[id^=item-box-npcLoot]");
	for (let k in nodes) {
		let node = nodes[k];
		if (node) {
			// finish and add this when 'adventurer log' is added
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

function getBoundFurnace() {
	return window.boundStoneFurnace !== 0 ? "boundStoneFurnace" : window.boundBronzeFurnace !== 0 ? "boundBronzeFurnace" :
		window.boundIronFurnace !== 0 ? "boundIronFurnace" : window.boundSilverFurnace !== 0 ? "boundSilverFurnace" : window.boundGoldFurnace !== 0 ? "boundGoldFurnace" : null;
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

function getSoonestWoodcuttingTimer() {
	let timer = null;
	for (let i = 1; i <= 6; i++) {
		if (window["treeId" + i] != 0) {
			let gt = TREES[window["treeId" + i]].growTime - window["treeGrowTimer" + i];
			timer = timer === null ? gt : gt < timer ? gt : timer;
		}
	}
	return timer;
}

function getBestFarmingTimer() {
	let timer = null;
	for (let i = 1; i <= (window.donorFarmingPatch ? 6 : 4); i++) {
		let gt = window["farmingPatchGrowTime" + i] - window["farmingPatchTimer" + i];
		timer = timer === null ? gt : gt < timer ? gt : timer;
	}
	return timer;
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
