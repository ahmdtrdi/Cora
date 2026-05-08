/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/cora_battle.json`.
 */
export type CoraBattle = {
  "address": "3eMDYJTc5uxA5CueLoRvdCiCvhUnjSZS7gVwX6jREQR8",
  "metadata": {
    "name": "coraBattle",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Ephemeral Rollup program for CORA Battle"
  },
  "instructions": [
    {
      "name": "activateSession",
      "docs": [
        "Activate the session after card registration is complete.",
        "Transitions WaitingCards → Active. Authority-only."
      ],
      "discriminator": [
        225,
        216,
        111,
        21,
        69,
        235,
        96,
        66
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "battle_session.match_id",
                "account": "battleSession"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "applyDamage",
      "docs": [
        "Apply damage to the opponent of the attacker.",
        "Authority-only. Backend verifies the answer off-chain,",
        "then calls this to record damage on-chain."
      ],
      "discriminator": [
        229,
        25,
        73,
        188,
        250,
        95,
        187,
        141
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "battle_session.match_id",
                "account": "battleSession"
              }
            ]
          }
        },
        {
          "name": "registeredCard",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "attacker",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "closeSession",
      "docs": [
        "Close a terminal session account and reclaim rent SOL.",
        "Authority-only. Only Finished or Cancelled sessions."
      ],
      "discriminator": [
        68,
        114,
        178,
        140,
        222,
        38,
        248,
        211
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "battle_session.match_id",
                "account": "battleSession"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "commitBattleSession",
      "docs": [
        "Schedule a BattleSession state commit from ER back to Solana."
      ],
      "discriminator": [
        63,
        180,
        117,
        22,
        4,
        108,
        97,
        37
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "battle_session.match_id",
                "account": "battleSession"
              }
            ]
          }
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "commitRegisteredCard",
      "docs": [
        "Schedule a RegisteredCard state commit from ER back to Solana."
      ],
      "discriminator": [
        6,
        161,
        25,
        234,
        133,
        174,
        127,
        77
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "battleSession"
        },
        {
          "name": "registeredCard",
          "writable": true
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createSession",
      "docs": [
        "Create a new battle session for two players.",
        "The signer becomes the session authority (backend oracle)."
      ],
      "discriminator": [
        242,
        193,
        143,
        179,
        150,
        25,
        122,
        227
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "playerA"
        },
        {
          "name": "playerB"
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "matchId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "matchId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "questionHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "delegateBattleSession",
      "docs": [
        "Delegate the BattleSession PDA from the Solana base layer to MagicBlock ER."
      ],
      "discriminator": [
        246,
        129,
        186,
        190,
        203,
        16,
        146,
        18
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferBattleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "battleSession"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                39,
                72,
                184,
                233,
                248,
                135,
                5,
                202,
                198,
                87,
                118,
                52,
                152,
                206,
                248,
                128,
                229,
                220,
                144,
                70,
                231,
                66,
                242,
                194,
                253,
                167,
                96,
                80,
                195,
                46,
                177,
                187
              ]
            }
          }
        },
        {
          "name": "delegationRecordBattleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "battleSession"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataBattleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "battleSession"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "battleSession",
          "writable": true
        },
        {
          "name": "ownerProgram",
          "address": "3eMDYJTc5uxA5CueLoRvdCiCvhUnjSZS7gVwX6jREQR8"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "delegateRegisteredCard",
      "docs": [
        "Delegate one RegisteredCard PDA so replay state can be mutated in ER."
      ],
      "discriminator": [
        128,
        61,
        132,
        99,
        66,
        67,
        175,
        81
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "battleSession"
        },
        {
          "name": "bufferRegisteredCard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "registeredCard"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                39,
                72,
                184,
                233,
                248,
                135,
                5,
                202,
                198,
                87,
                118,
                52,
                152,
                206,
                248,
                128,
                229,
                220,
                144,
                70,
                231,
                66,
                242,
                194,
                253,
                167,
                96,
                80,
                195,
                46,
                177,
                187
              ]
            }
          }
        },
        {
          "name": "delegationRecordRegisteredCard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "registeredCard"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataRegisteredCard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "registeredCard"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "registeredCard",
          "writable": true
        },
        {
          "name": "ownerProgram",
          "address": "3eMDYJTc5uxA5CueLoRvdCiCvhUnjSZS7gVwX6jREQR8"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "cardId",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        }
      ]
    },
    {
      "name": "finalizeMatch",
      "docs": [
        "Emit the BattleFinalized event for the settlement oracle.",
        "Authority-only. Session must be in Finished status."
      ],
      "discriminator": [
        6,
        103,
        47,
        7,
        66,
        1,
        85,
        207
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "battleSession",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "battle_session.match_id",
                "account": "battleSession"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "forceEnd",
      "docs": [
        "Force-end a timed-out session. Authority-only.",
        "Only callable after SESSION_TIMEOUT has elapsed."
      ],
      "discriminator": [
        182,
        253,
        37,
        77,
        135,
        204,
        99,
        160
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "battle_session.match_id",
                "account": "battleSession"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "processUndelegation",
      "discriminator": [
        196,
        28,
        41,
        206,
        48,
        37,
        51,
        167
      ],
      "accounts": [
        {
          "name": "baseAccount",
          "writable": true
        },
        {
          "name": "buffer"
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "accountSeeds",
          "type": {
            "vec": "bytes"
          }
        }
      ]
    },
    {
      "name": "registerCard",
      "docs": [
        "Register a card (question mapping) for a battle session.",
        "Authority-only. Only allowed in WaitingCards status."
      ],
      "discriminator": [
        33,
        25,
        154,
        111,
        155,
        31,
        45,
        36
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "battleSession"
        },
        {
          "name": "registeredCard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "battleSession"
              },
              {
                "kind": "arg",
                "path": "cardId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "cardId",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "damage",
          "type": "u16"
        }
      ]
    },
    {
      "name": "undelegateBattleSession",
      "docs": [
        "Commit and undelegate the BattleSession PDA when the battle has ended."
      ],
      "discriminator": [
        15,
        152,
        195,
        62,
        218,
        157,
        220,
        114
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "battle_session.match_id",
                "account": "battleSession"
              }
            ]
          }
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "undelegateRegisteredCard",
      "docs": [
        "Commit and undelegate a RegisteredCard PDA when the battle has ended."
      ],
      "discriminator": [
        102,
        60,
        153,
        72,
        76,
        24,
        24,
        96
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "battleSession"
        },
        {
          "name": "registeredCard",
          "writable": true
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "battleSession",
      "discriminator": [
        254,
        114,
        29,
        174,
        211,
        191,
        25,
        241
      ]
    },
    {
      "name": "registeredCard",
      "discriminator": [
        148,
        137,
        2,
        150,
        69,
        216,
        200,
        18
      ]
    }
  ],
  "events": [
    {
      "name": "battleFinalizedEvent",
      "discriminator": [
        142,
        217,
        149,
        240,
        232,
        110,
        81,
        78
      ]
    },
    {
      "name": "cardRegisteredEvent",
      "discriminator": [
        0,
        83,
        86,
        238,
        44,
        94,
        148,
        156
      ]
    },
    {
      "name": "damageAppliedEvent",
      "discriminator": [
        159,
        137,
        92,
        244,
        19,
        105,
        85,
        91
      ]
    },
    {
      "name": "roundEndedEvent",
      "discriminator": [
        225,
        93,
        137,
        158,
        12,
        107,
        81,
        122
      ]
    },
    {
      "name": "sessionActivatedEvent",
      "discriminator": [
        58,
        171,
        147,
        8,
        109,
        155,
        244,
        242
      ]
    },
    {
      "name": "sessionCancelledEvent",
      "discriminator": [
        172,
        115,
        8,
        217,
        141,
        247,
        142,
        175
      ]
    },
    {
      "name": "sessionCreatedEvent",
      "discriminator": [
        35,
        41,
        98,
        73,
        187,
        32,
        19,
        12
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidStatus",
      "msg": "Session is not in the expected status"
    },
    {
      "code": 6001,
      "name": "unauthorizedPlayer",
      "msg": "Player is not a participant in this session"
    },
    {
      "code": 6002,
      "name": "unregisteredCard",
      "msg": "Card does not belong to this session"
    },
    {
      "code": 6003,
      "name": "unauthorizedAuthority",
      "msg": "Only the session authority can perform this action"
    },
    {
      "code": 6004,
      "name": "alreadyFinished",
      "msg": "Session has already finished"
    },
    {
      "code": 6005,
      "name": "samePlayer",
      "msg": "Player A and Player B cannot be the same address"
    },
    {
      "code": 6006,
      "name": "cardAlreadyUsed",
      "msg": "Card has already been used in this session"
    },
    {
      "code": 6007,
      "name": "invalidDamage",
      "msg": "Damage value is out of allowed range"
    },
    {
      "code": 6008,
      "name": "invalidTarget",
      "msg": "Target must be a participant in this session"
    },
    {
      "code": 6009,
      "name": "timeoutNotReached",
      "msg": "Session timeout has not been reached yet"
    },
    {
      "code": 6010,
      "name": "sessionExpired",
      "msg": "Session has expired due to timeout"
    },
    {
      "code": 6011,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow in game state calculation"
    }
  ],
  "types": [
    {
      "name": "battleFinalizedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "scoreA",
            "type": "u16"
          },
          {
            "name": "scoreB",
            "type": "u16"
          },
          {
            "name": "roundsWonA",
            "type": "u8"
          },
          {
            "name": "roundsWonB",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "battleSession",
      "docs": [
        "The main battle session account, tracking all on-chain game state.",
        "Acts as a \"blind HP calculator\" — answer verification happens off-chain",
        "in the backend, only damage application is recorded on-chain."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "docs": [
              "Schema version for forward-compatible upgrades"
            ],
            "type": "u8"
          },
          {
            "name": "matchId",
            "docs": [
              "Unique match identifier (sha256 of match UUID from backend)"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "authority",
            "docs": [
              "The backend oracle authority that controls this session.",
              "Only this signer can register cards, apply damage, and finalize."
            ],
            "type": "pubkey"
          },
          {
            "name": "playerA",
            "docs": [
              "Player A's wallet address"
            ],
            "type": "pubkey"
          },
          {
            "name": "playerB",
            "docs": [
              "Player B's wallet address"
            ],
            "type": "pubkey"
          },
          {
            "name": "healthA",
            "docs": [
              "Player A's current health points (reset each round)"
            ],
            "type": "u16"
          },
          {
            "name": "healthB",
            "docs": [
              "Player B's current health points (reset each round)"
            ],
            "type": "u16"
          },
          {
            "name": "scoreA",
            "docs": [
              "Player A's total correct answers across all rounds"
            ],
            "type": "u16"
          },
          {
            "name": "scoreB",
            "docs": [
              "Player B's total correct answers across all rounds"
            ],
            "type": "u16"
          },
          {
            "name": "currentRound",
            "docs": [
              "Current round number (1-indexed, max MAX_ROUNDS)"
            ],
            "type": "u8"
          },
          {
            "name": "roundsWonA",
            "docs": [
              "Rounds won by player A"
            ],
            "type": "u8"
          },
          {
            "name": "roundsWonB",
            "docs": [
              "Rounds won by player B"
            ],
            "type": "u8"
          },
          {
            "name": "totalPlays",
            "docs": [
              "Total damage events applied (audit trail)"
            ],
            "type": "u16"
          },
          {
            "name": "status",
            "docs": [
              "Current battle status (state machine)"
            ],
            "type": {
              "defined": {
                "name": "battleStatus"
              }
            }
          },
          {
            "name": "winner",
            "docs": [
              "Winner's pubkey (Pubkey::default() until Finished)"
            ],
            "type": "pubkey"
          },
          {
            "name": "questionHash",
            "docs": [
              "SHA-256 hash of the question set used (fairness proof)"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed"
            ],
            "type": "u8"
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp when session was created"
            ],
            "type": "i64"
          },
          {
            "name": "finishedAt",
            "docs": [
              "Unix timestamp when session finished (0 if not finished)"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "battleStatus",
      "docs": [
        "State machine for battle lifecycle.",
        "Transitions: WaitingCards → Active → Finished",
        "→ Cancelled (via force_end)",
        "WaitingCards → Cancelled (via force_end)"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "waitingCards"
          },
          {
            "name": "active"
          },
          {
            "name": "finished"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "cardRegisteredEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "cardId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "damage",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "damageAppliedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "attacker",
            "type": "pubkey"
          },
          {
            "name": "damage",
            "type": "u16"
          },
          {
            "name": "healthA",
            "type": "u16"
          },
          {
            "name": "healthB",
            "type": "u16"
          },
          {
            "name": "round",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "registeredCard",
      "docs": [
        "A registered card representing one question's damage potential.",
        "The card_id uses dummy ephemeral IDs to prevent correlation with",
        "real question IDs in the database (privacy via Ephemeral Mapping)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "session",
            "docs": [
              "Reference to parent BattleSession PDA"
            ],
            "type": "pubkey"
          },
          {
            "name": "cardId",
            "docs": [
              "Dummy card identifier for ephemeral mapping"
            ],
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "damage",
            "docs": [
              "Damage this card deals when the backend confirms a correct answer"
            ],
            "type": "u16"
          },
          {
            "name": "isUsed",
            "docs": [
              "Replay protection — card can only be used once"
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "roundEndedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "round",
            "type": "u8"
          },
          {
            "name": "roundWinner",
            "type": "pubkey"
          },
          {
            "name": "roundsWonA",
            "type": "u8"
          },
          {
            "name": "roundsWonB",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "sessionActivatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "sessionCancelledEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "reason",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "sessionCreatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "playerA",
            "type": "pubkey"
          },
          {
            "name": "playerB",
            "type": "pubkey"
          },
          {
            "name": "questionHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    }
  ]
};
