define([
	'ash',
	'json!game/data/EnemyData.json',
	'game/GameGlobals',
	'game/constants/EnemyConstants',
	'game/constants/FollowerConstants',
	'game/constants/PerkConstants',
	'game/constants/ItemConstants',
	'game/constants/FightConstants',
	'game/constants/UpgradeConstants',
	'game/constants/WorldConstants',
	'game/components/player/ItemsComponent',
	'game/components/player/FollowersComponent',
	'game/vos/EnemyVO',
	'utils/MathUtils',
], function (
	Ash,
	EnemyData,
	GameGlobals,
	EnemyConstants,
	FollowerConstants,
	PerkConstants,
	ItemConstants,
	FightConstants,
	UpgradeConstants,
	WorldConstants,
	ItemsComponent,
	FollowersComponent,
	EnemyVO,
	MathUtils
) {
	var EnemyCreator = Ash.Class.extend({
		
		constructor: function () {},
		
		createEnemies: function () {
			EnemyConstants.enemyDefinitions = {};
			
			// TODO check nouns and verbs for orphans (only one/few enemies using)
			
			for (enemyID in EnemyData) {
				let def = EnemyData[enemyID];
				let type = def.type;
				let enemyVO = this.createEnemy(
					enemyID, def.name, type,
					def.nouns, def.groupNouns, def.verbsActive, def.verbsDefeated,
					def.campOrdinal || 0, def.difficulty || 5,
					def.attackRatio || 0.5, def.shieldRatio || 0, def.healthFactor || 1, def.shieldFactor || 1, def.size || 1, def.speed || 1,
					def.rarity || 1,
					def.droppedResources
				);
				if (!EnemyConstants.enemyDefinitions[type]) EnemyConstants.enemyDefinitions[type] = [];
			 	EnemyConstants.enemyDefinitions[type].push(enemyVO.cloneWithIV(50));
			}
		},

		// Enemy definitions (speed: around 1, rarity: 0-100)
		createEnemy: function (id, name, type, nouns, groupN, activeV, defeatedV, campOrdinal, normalizedDifficulty, attRatio, shieldRatio, healthFactor, shieldFactor, size, speed, rarity, droppedResources) {
			// normalizedDifficulty (1-10) -> camp step and difficulty within camp step
			normalizedDifficulty = MathUtils.clamp(normalizedDifficulty, 1, 10);
			let step = 0;
			let difficultyFactor = 0;
			if (normalizedDifficulty <= 3) {
				step = WorldConstants.CAMP_STEP_START;
				difficultyFactor = MathUtils.map(normalizedDifficulty, 1, 3, 0, 1);
			} else if (normalizedDifficulty <= 7) {
				step = WorldConstants.CAMP_STEP_POI_2;
				difficultyFactor = MathUtils.map(normalizedDifficulty, 4, 7, 0, 1);
			} else  {
				step = WorldConstants.CAMP_STEP_END;
				difficultyFactor = MathUtils.map(normalizedDifficulty, 8, 10, 0, 1);
			}
			
			// speed (just normalize)
			speed = Math.max(speed, 0.1);
			
			// campOrdinal, step -> reference player stats (adjusted for difficulty factor)
			let playerAtt = this.getStatBase(campOrdinal, step, difficultyFactor, this.getPlayerAtt);
			let playerDef =  this.getStatBase(campOrdinal, step, difficultyFactor, this.getPlayerDef);
			let playerHPShield = this.getStatBase(campOrdinal, step, difficultyFactor, this.getPlayerHpShield);
			let playerSpeed = this.getPlayerSpeed(campOrdinal, step);
			
			// player def, hp, shield + enemy speed -> enemy att
			// goal: about 5 seconds to kill player
			let targetDPH = playerHPShield / 5 / speed;
			let att = Math.max(1, this.getAttack(targetDPH, playerDef));
			
			// att + attRatio -> enemy def
			// goal: att / (att + def) = attRatio
			let attackFactor = MathUtils.clamp(attRatio, 0.1, 0.9);
			let def = Math.max(1, this.getDefence(att, attackFactor));
			
			// player att, speed, enemy def -> enemy hp/shield total
			// goal: about 5 seconds to kill player
			let playerDPS = FightConstants.getDamagePerSec(playerAtt, def, playerSpeed);
			let hpshieldtotal = playerDPS * 5;
			
			// hpshieldtotal, healthFactor (0-1), shieldFactor (0-1), size -> hp and shield
			let hp = Math.round(hpshieldtotal * (1 - shieldRatio) * healthFactor);
			let shield = Math.round(hpshieldtotal * shieldRatio * shieldFactor);
			
			// normalize the rest
			size = MathUtils.clamp(size, 0.1, 2);
			rarity = MathUtils.clamp(rarity, 1, 100);
			droppedResources = droppedResources || [];
			
			EnemyConstants.enemyDifficulties[id] = this.getDifficulty(campOrdinal, step);
			
			// log.i("goal strength: " + strength + " | actual strength: " + FightConstants.getStrength(att, def, speed));

			return new EnemyVO(id, name, type, nouns, groupN, activeV, defeatedV, size, att, def, hp, shield, speed, rarity, droppedResources);
		},
		
		getStatBase: function (campOrdinal, step, difficultyFactor, statfunc) {
			let current = statfunc.call(this, campOrdinal, step);
			
			if (campOrdinal == 0) return current;
			
			let previousTotal = 0;
			let previousNum = 0;
			let prevCamp = campOrdinal;
			let prevStep = step;
			while (previousNum < 6 && prevCamp > 0) {
				prevStep--;
				if (prevStep < WorldConstants.CAMP_STEP_START) {
					prevCamp--;
					prevStep = WorldConstants.CAMP_STEP_END;
				}
				let previous = statfunc.call(this, prevCamp, prevStep);
				previousTotal += previous;
				previousNum++;
				if (previousNum > 1 && previous < current) break;
			}
			
			let min = previousNum > 0 ? previousTotal / previousNum : 0;
			let max = current;
			
			return MathUtils.map(difficultyFactor, 0, 1, min, max);
		},
		
		getPlayerStrength: function (campOrdinal, step) {
			let playerAtt = this.getPlayerAtt(campOrdinal, step);
			let playerDef = this.getPlayerDef(campOrdinal, step);
			let playerSpeed = this.getPlayerSpeed(campOrdinal, step);
			return FightConstants.getStrength(playerAtt, playerDef, playerSpeed);
		},
		
		getPlayerAtt: function (campOrdinal, step) {
			let playerStamina = this.getTypicalStamina(campOrdinal, step);
			let itemsComponent = this.getTypicalItems(campOrdinal, step);
			let followersComponent = this.getTypicalFollowers(campOrdinal, step);
			return FightConstants.getPlayerAtt(playerStamina, itemsComponent, followersComponent);
		},
		
		getPlayerDef: function (campOrdinal, step) {
			let playerStamina = this.getTypicalStamina(campOrdinal, step);
			let itemsComponent = this.getTypicalItems(campOrdinal, step);
			let followersComponent = this.getTypicalFollowers(campOrdinal, step);
			return FightConstants.getPlayerDef(playerStamina, itemsComponent, followersComponent);
		},
		
		getPlayerSpeed: function (campOrdinal, step) {
			let itemsComponent = this.getTypicalItems(campOrdinal, step);
			return FightConstants.getPlayerSpeed(itemsComponent);
		},
		
		getAttack: function (targetDPH, playerDef) {
			return Math.round(FightConstants.getAttackForDPH(targetDPH, playerDef));
		},
		
		getDefence: function (att, attFactor) {
			return Math.round(att * (1/attFactor - 1));
		},
		
		getAttDef: function (strength, speed) {
			// str = att * (F + spd * F) + def;
			// assuming att == def == ad
			let ad = strength / (speed * FightConstants.STRENGTH_ATT_FACTOR + FightConstants.STRENGTH_ATT_FACTOR + 1);
			return ad * 2;
		},
		
		getPlayerHpShield: function (campOrdinal, step) {
			let playerStamina = this.getTypicalStamina(campOrdinal, step);
			return playerStamina.maxHP + playerStamina.maxShield;
		},
		
		getEnemyHpShield: function (campOrdinal, step) {
			let playerHPShield = this.getPlayerHpShield(campOrdinal, step);
			
			let playerStamina = this.getTypicalStamina(campOrdinal, step);
			let itemsComponent = this.getTypicalItems(campOrdinal, step);
			let followersComponent = this.getTypicalFollowers(campOrdinal, step);
			let playerAtt = FightConstants.getPlayerAtt(playerStamina, itemsComponent, followersComponent);
			
			// average of two factors:
			// - player hp and shield (should be comparable)
			// - player attack (nice fight duration since player attack is maximum damage player can do)
			// att matters less as numbers (relative to typical hp) grow and it's balanced by def
			let defaultHP = 100;
			let attFactor = defaultHP / playerAtt / 50;
			return attFactor * playerAtt + (1-attFactor) * playerHPShield;
		},

		// get enemies by type (string) and difficulty (campOrdinal and step)
		// by default will also include enemies of one difficulty lower, if restrictDifficulty, then not
		// will return at least one enemy; if no matching enemy exists, one with lower difficulty is returned
		getEnemies: function (type, difficulty, restrictDifficulty) {
			var enemies = [];
			if (difficulty <= 0) return enemies;

			var enemy;
			var enemyDifficulty;
			var enemyList = [];
			if (type) {
				enemyList = EnemyConstants.enemyDefinitions[type];
			} else {
				for (var type in EnemyConstants.enemyTypes) {
					enemyList = enemyList.concat(EnemyConstants.enemyDefinitions[type]);
				}
			}
			
			for (let i = 0; i < enemyList.length; i++) {
				enemy = enemyList[i];
				enemyDifficulty = Math.max(EnemyConstants.enemyDifficulties[enemy.id], 1);
				if (enemyDifficulty === difficulty)
					enemies.push(enemy);
				if (enemyDifficulty === difficulty - 1 && difficulty > 1 && !restrictDifficulty)
					enemies.push(enemy);
			}

			if (enemies.length <= 0) {
				return this.getEnemies(type, difficulty - 1, restrictDifficulty);
			}

			return enemies;
		},

		// get the difficulty level (1-3*15, corresponding to camp ordinal and step) of a given enemy
		getEnemyDifficultyLevel: function (enemy) {
			if (!EnemyConstants.enemyDifficulties && EnemyConstants.enemyDifficulties[enemy.id])  {
				log.w("enemy difficulty not defined: " + enemy.id);
				return 0;
			}
			return EnemyConstants.enemyDifficulties[enemy.id];
		},
		
		getCampOrdinalFromDifficulty: function (difficulty) {
			return Math.ceil(difficulty/3);
		},
		
		getStepFromDifficulty: function (difficulty) {
			return difficulty - (this.getCampOrdinalFromDifficulty(difficulty) - 1)*3;
		},
		
		getDifficulty: function (campOrdinal, step) {
			return (campOrdinal - 1)*3 + step;
		},
		
		getTypicalItems: function (campOrdinal, step, isHardLevel) {
			var typicalItems = new ItemsComponent();
			var typicalWeapon = GameGlobals.itemsHelper.getDefaultWeapon(campOrdinal, step);
			var typicalClothing = GameGlobals.itemsHelper.getDefaultClothing(campOrdinal, step, ItemConstants.itemBonusTypes.fight_def, isHardLevel);

			if (typicalWeapon) {
				typicalItems.addItem(typicalWeapon, false);
			}

			if (typicalClothing.length > 0) {
				for (let i = 0; i < typicalClothing.length; i++) {
					typicalItems.addItem(typicalClothing[i], false);
				}
			}
			
			typicalItems.autoEquipAll();
			return typicalItems;
		},
		
		getTypicalFollowers: function (campOrdinal, step) {
			let typicalFollowers = new FollowersComponent();
			if (!WorldConstants.isHigherOrEqualCampOrdinalAndStep(campOrdinal, step, FollowerConstants.FIRST_FOLLOWER_CAMP_ORDINAL, WorldConstants.CAMP_STEP_POI_2)) {
				return typicalFollowers;
			}
			
			// only considering fight related followers here
			let source = FollowerConstants.followerSource.EVENT;
			let abilityType = FollowerConstants.abilityType.ATTACK;
			let follower = FollowerConstants.getNewRandomFollower(source, campOrdinal, campOrdinal, abilityType, 0.5);
			typicalFollowers.addFollower(follower);
			typicalFollowers.setFollowerInParty(follower, true);
			
			return typicalFollowers;
		},
		
		getTypicalStamina: function (campOrdinal, step, isHardLevel) {
			var healthyPerkFactor = 1;
			
			let campAndStepPerk1 = UpgradeConstants.getExpectedCampAndStepForUpgrade("improve_building_hospital",);
			let campAndStepPerk2 = UpgradeConstants.getExpectedCampAndStepForUpgrade("improve_building_hospital_3");

			if (WorldConstants.isHigherOrEqualCampOrdinalAndStep(campOrdinal, step, campAndStepPerk2.campOrdinal, campAndStepPerk2.step)) {
				healthyPerkFactor = PerkConstants.getPerk(PerkConstants.perkIds.healthBonus3).effect;
			} else if (WorldConstants.isHigherOrEqualCampOrdinalAndStep(campOrdinal, step, campAndStepPerk1.campOrdinal, campAndStepPerk1.step)) {
				healthyPerkFactor = PerkConstants.getPerk(PerkConstants.perkIds.healthBonus2).effect;
			}
			
			var injuryFactor = 1;
			if (campOrdinal <= 1 && step <= WorldConstants.CAMP_STEP_START)
			 	injuryFactor = 0.5;
			
			let typicalHealth = Math.round(100 * healthyPerkFactor * injuryFactor);
				
			let typicalItems = this.getTypicalItems(campOrdinal, step, isHardLevel);
				
			var typicalStamina = {};
			typicalStamina.health = typicalHealth;
			typicalStamina.maxHP = typicalHealth;
			typicalStamina.maxShield = typicalItems.getCurrentBonus(ItemConstants.itemBonusTypes.fight_shield);
			
			return typicalStamina;
		}
		
	});

	return EnemyCreator;
});
