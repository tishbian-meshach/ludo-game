/**
 * DebugConsole - Exposes game internals for debugging via browser console
 * Usage: Open browser DevTools console and type `debug.help()` for commands
 */

import { GameState } from '../engine2d/GameState';
import { TokenModel } from '../engine2d/TokenModel';
import { eventBus } from '../engine2d/EventBus';

interface DebugAPI {
    help: () => void;
    listTokens: (playerIndex?: number) => void;
    moveToken: (tokenId: string, position: number) => void;
    finishToken: (tokenId: string) => void;
    finishAllTokens: (playerIndex: number) => void;
    makeWinner: (playerIndex: number) => void;
    enterBoard: (tokenId: string) => void;
    setDice: (value: number) => void;
    roll: (value: number) => void;  // Alias for setDice
    on: () => void;
    off: () => void;
    info: () => void;
}

export function setupDebugConsole(gameState: GameState): void {
    const tokenModel = gameState.getTokens();

    const debug: DebugAPI = {
        help: () => {
            console.log(`
%c🎲 Ludo Debug Console %c

Available commands:
  debug.help()                  - Show this help message
  debug.info()                  - Show current game state info
  debug.listTokens()            - List all tokens
  debug.listTokens(playerIndex) - List tokens for a specific player (0-3)
  debug.moveToken(tokenId, pos) - Move token to main track position (0-51)
  debug.moveToken(tokenId, 100+n) - Move token to home stretch cell n (100-105)
  debug.finishToken(tokenId)    - Move token to finished state
  debug.finishAllTokens(player) - Finish all 4 tokens for a player
  debug.makeWinner(player)      - Make a player finish & trigger GAME_WON event
  debug.enterBoard(tokenId)     - Enter a token onto the board
  debug.setDice(value)          - Set the dice value (1-6)

Player indices:
  0 = Red, 1 = Green, 2 = Yellow, 3 = Blue

Token ID format:
  "red-0", "red-1", "green-2", "blue-3", etc.

Examples:
  debug.makeWinner(0)           - Make Red finish 1st
  debug.makeWinner(1)           - Then make Green finish 2nd
  debug.finishAllTokens(2)      - Finish all Yellow tokens (without triggering event)
  debug.listTokens(0)           - Show all Red player tokens
  debug.moveToken("red-0", 10)  - Move Red's first token to cell 10
`, 'color: #FFD700; font-size: 16px; font-weight: bold;', 'color: inherit;');
        },

        info: () => {
            const phase = gameState.getPhase();
            const currentPlayer = gameState.getCurrentPlayer();
            const turnPhase = gameState.getTurnPhase();
            const playerCount = gameState.getPlayerCount();
            const winner = gameState.getWinner();

            console.log(`
%c🎮 Game Info %c
  Phase: ${phase}
  Current Player: ${currentPlayer} (${['Red', 'Green', 'Yellow', 'Blue'][currentPlayer]})
  Turn Phase: ${turnPhase}
  Player Count: ${playerCount}
  Winner: ${winner !== null ? winner : 'None'}
`, 'color: #00FF99; font-weight: bold;', 'color: inherit;');
        },

        listTokens: (playerIndex?: number) => {
            const allTokens = tokenModel.getAllTokens();
            const tokens = playerIndex !== undefined
                ? allTokens.filter(t => t.playerIndex === playerIndex)
                : allTokens;

            console.log(`%c📍 Tokens (${tokens.length})`, 'color: #00CCFF; font-weight: bold;');

            tokens.forEach(token => {
                const posStr = token.position.type === 'main'
                    ? `main[${token.position.cellIndex}]`
                    : token.position.type === 'home-stretch'
                        ? `home-stretch[${token.position.cellIndex}]`
                        : token.position.type === 'spawn'
                            ? `spawn[${token.position.spawnIndex}]`
                            : 'finished';

                console.log(`  ${token.id}: ${token.state} @ ${posStr} (steps: ${token.stepsFromStart})`);
            });
        },

        moveToken: (tokenId: string, position: number) => {
            const token = tokenModel.getToken(tokenId);
            if (!token) {
                console.error(`Token "${tokenId}" not found`);
                return;
            }

            // Directly manipulate token position for debugging
            // This bypasses normal game rules
            if (position >= 100) {
                // Home stretch position
                const cellIndex = position - 100;
                (token as any).position = { type: 'home-stretch', cellIndex };
                (token as any).state = 'home-stretch';
                (token as any).mainTrackPosition = position;
            } else if (position === -1) {
                // Finished
                (token as any).position = { type: 'finished' };
                (token as any).state = 'finished';
                (token as any).mainTrackPosition = -1;
            } else {
                // Main track
                (token as any).position = { type: 'main', cellIndex: position };
                (token as any).state = 'on-board';
                (token as any).mainTrackPosition = position;
            }

            console.log(`%c✅ Moved ${tokenId} to position ${position}`, 'color: #00FF99;');
        },

        finishToken: (tokenId: string) => {
            const token = tokenModel.getToken(tokenId);
            if (!token) {
                console.error(`Token "${tokenId}" not found`);
                return;
            }

            (token as any).position = { type: 'finished' };
            (token as any).state = 'finished';
            (token as any).mainTrackPosition = -1;

            console.log(`%c🏆 Finished ${tokenId}`, 'color: #FFD700;');
        },

        enterBoard: (tokenId: string) => {
            const token = tokenModel.getToken(tokenId);
            if (!token) {
                console.error(`Token "${tokenId}" not found`);
                return;
            }

            tokenModel.enterBoard(tokenId);
            console.log(`%c🚀 Entered ${tokenId} onto the board`, 'color: #00CCFF;');
        },

        finishAllTokens: (playerIndex: number) => {
            if (playerIndex < 0 || playerIndex > 3) {
                console.error('Player index must be 0-3');
                return;
            }

            const playerColors = ['red', 'green', 'yellow', 'blue'];
            const color = playerColors[playerIndex];

            for (let i = 0; i < 4; i++) {
                const tokenId = `${color}-${i}`;
                const token = tokenModel.getToken(tokenId);
                if (token) {
                    (token as any).position = { type: 'finished' };
                    (token as any).state = 'finished';
                    (token as any).mainTrackPosition = -1;
                }
            }

            console.log(`%c🏆 Finished all tokens for Player ${playerIndex} (${color})`, 'color: #FFD700;');
        },

        makeWinner: (playerIndex: number) => {
            if (playerIndex < 0 || playerIndex > 3) {
                console.error('Player index must be 0-3 (0=Red, 1=Green, 2=Yellow, 3=Blue)');
                return;
            }

            const playerColors = ['Red', 'Green', 'Yellow', 'Blue'];

            // Finish all tokens for this player (required for win check)
            debug.finishAllTokens(playerIndex);

            // Trigger the GAME_WON event
            eventBus.emit('GAME_WON', { player: playerIndex });

            console.log(`%c🥇 Player ${playerIndex} (${playerColors[playerIndex]}) is now a WINNER!`,
                'color: #FFD700; font-size: 14px; font-weight: bold;');
        },

        setDice: (value: number) => {
            if (value < 1 || value > 6) {
                console.error('Dice value must be between 1 and 6');
                return;
            }

            // Use the actual DiceLogic debug method
            gameState.getDiceLogic().debugSetNextRoll(value);
            console.log(`%c🎲 Next dice roll will be: ${value}`, 'color: #FFFF00; font-weight: bold;');
        },

        roll: (value: number) => {
            // Alias for setDice
            debug.setDice(value);
        },

        on: () => {
            (window as any).__debugMode = true;
            console.log('%c🐛 Debug Mode: ON', 'color: #00FF99; font-size: 14px; font-weight: bold;');
            console.log('  • Forced dice: debug.roll(1-6)');
            console.log('  • Type debug.help() for all commands');
        },

        off: () => {
            (window as any).__debugMode = false;
            (window as any).__forcedDice = null;
            console.log('%c🐛 Debug Mode: OFF', 'color: #FF6666; font-size: 14px; font-weight: bold;');
        }
    };

    // Expose to window
    (window as any).debug = debug;

    console.log('%c🎲 Ludo Debug Console Ready! Type debug.help() for commands.',
        'color: #FFD700; font-size: 14px; font-weight: bold; background: #1a1a2e; padding: 8px 12px; border-radius: 4px;');
}
