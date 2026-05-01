/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/solana_program.json`.
 */
export type SolanaProgram = {
  "address": "9Pqkgy5uu9w2HvgyNUnHEvzdRWSv1h6GyCuD4uKBVp1W",
  "metadata": {
    "name": "solanaProgram",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "depositWager",
      "discriminator": [
        234,
        73,
        235,
        136,
        168,
        103,
        239,
        207
      ],
      "accounts": [
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "matchState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "match_state.match_id",
                "account": "matchState"
              }
            ]
          }
        },
        {
          "name": "depositorTokenAccount",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "match_state.match_id",
                "account": "matchState"
              }
            ]
          }
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "initializeConfig",
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
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
          "name": "treasuryAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initializeMatch",
      "discriminator": [
        156,
        133,
        52,
        179,
        176,
        29,
        64,
        124
      ],
      "accounts": [
        {
          "name": "playerA",
          "writable": true,
          "signer": true
        },
        {
          "name": "playerB"
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "matchState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  99,
                  104
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
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
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
          "name": "tokenProgram"
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
          "name": "wagerAmount",
          "type": "u64"
        },
        {
          "name": "serverPubkey",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "refund",
      "discriminator": [
        2,
        96,
        183,
        251,
        63,
        208,
        46,
        46
      ],
      "accounts": [
        {
          "name": "caller",
          "writable": true,
          "signer": true
        },
        {
          "name": "matchState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "match_state.match_id",
                "account": "matchState"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "match_state.match_id",
                "account": "matchState"
              }
            ]
          }
        },
        {
          "name": "playerATokenAccount",
          "writable": true
        },
        {
          "name": "playerBTokenAccount",
          "writable": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "settleMatch",
      "discriminator": [
        71,
        124,
        117,
        96,
        191,
        217,
        116,
        24
      ],
      "accounts": [
        {
          "name": "caller",
          "writable": true,
          "signer": true
        },
        {
          "name": "matchState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "match_state.match_id",
                "account": "matchState"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "match_state.match_id",
                "account": "matchState"
              }
            ]
          }
        },
        {
          "name": "playerATokenAccount",
          "writable": true
        },
        {
          "name": "playerBTokenAccount",
          "writable": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "action",
          "type": "u8"
        },
        {
          "name": "target",
          "type": "pubkey"
        },
        {
          "name": "signature",
          "type": {
            "array": [
              "u8",
              64
            ]
          }
        }
      ]
    },
    {
      "name": "updateConfig",
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newTreasuryAuthority",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "matchState",
      "discriminator": [
        250,
        209,
        137,
        70,
        235,
        96,
        121,
        216
      ]
    },
    {
      "name": "programConfig",
      "discriminator": [
        196,
        210,
        90,
        231,
        144,
        149,
        140,
        63
      ]
    }
  ],
  "events": [
    {
      "name": "configInitializedEvent",
      "discriminator": [
        22,
        167,
        192,
        50,
        220,
        20,
        10,
        71
      ]
    },
    {
      "name": "configUpdatedEvent",
      "discriminator": [
        245,
        158,
        129,
        99,
        60,
        100,
        214,
        220
      ]
    },
    {
      "name": "matchInitializedEvent",
      "discriminator": [
        75,
        64,
        91,
        119,
        84,
        109,
        244,
        34
      ]
    },
    {
      "name": "matchRefundedEvent",
      "discriminator": [
        15,
        197,
        212,
        55,
        111,
        154,
        77,
        158
      ]
    },
    {
      "name": "matchSettledEvent",
      "discriminator": [
        56,
        219,
        213,
        131,
        79,
        126,
        13,
        227
      ]
    },
    {
      "name": "wagerDepositedEvent",
      "discriminator": [
        54,
        33,
        14,
        83,
        152,
        191,
        114,
        255
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidWagerAmount",
      "msg": "Wager amount must be greater than min_wager"
    },
    {
      "code": 6001,
      "name": "samePlayer",
      "msg": "Player A and Player B cannot be the same"
    },
    {
      "code": 6002,
      "name": "unauthorizedPlayer",
      "msg": "Player is not a participant in this match"
    },
    {
      "code": 6003,
      "name": "alreadyDeposited",
      "msg": "Player has already deposited"
    },
    {
      "code": 6004,
      "name": "notActive",
      "msg": "Match is not in active status"
    },
    {
      "code": 6005,
      "name": "alreadyFinalized",
      "msg": "Match is already settled or refunded"
    },
    {
      "code": 6006,
      "name": "notWaitingDeposit",
      "msg": "Match is not waiting for deposits"
    },
    {
      "code": 6007,
      "name": "invalidAction",
      "msg": "Invalid action parameter"
    },
    {
      "code": 6008,
      "name": "invalidSignature",
      "msg": "Invalid settlement signature"
    },
    {
      "code": 6009,
      "name": "invalidWinner",
      "msg": "Winner must be a match participant"
    },
    {
      "code": 6010,
      "name": "timeoutNotReached",
      "msg": "Timeout has not been reached yet"
    },
    {
      "code": 6011,
      "name": "invalidTokenMint",
      "msg": "Token mint does not match match state"
    },
    {
      "code": 6012,
      "name": "invalidRefundState",
      "msg": "Match state is inconsistent for refund"
    },
    {
      "code": 6013,
      "name": "unauthorizedAdmin",
      "msg": "Only the admin can perform this action"
    },
    {
      "code": 6014,
      "name": "invalidTreasury",
      "msg": "Treasury account does not belong to the configured authority"
    }
  ],
  "types": [
    {
      "name": "configInitializedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "treasuryAuthority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "configUpdatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "newTreasuryAuthority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "matchInitializedEvent",
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
            "name": "playerA",
            "type": "pubkey"
          },
          {
            "name": "playerB",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "wagerAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "matchRefundedEvent",
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
      "name": "matchSettledEvent",
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
            "name": "action",
            "type": "u8"
          },
          {
            "name": "target",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "matchState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
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
            "name": "playerA",
            "type": "pubkey"
          },
          {
            "name": "playerB",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "serverPubkey",
            "type": "pubkey"
          },
          {
            "name": "wagerAmount",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "matchStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "activeAt",
            "type": "i64"
          },
          {
            "name": "playerADeposited",
            "type": "bool"
          },
          {
            "name": "playerBDeposited",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "matchStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "waitingDeposit"
          },
          {
            "name": "active"
          },
          {
            "name": "settled"
          },
          {
            "name": "refunded"
          }
        ]
      }
    },
    {
      "name": "programConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "treasuryAuthority",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "wagerDepositedEvent",
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
            "name": "depositor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "matchActive",
            "type": "bool"
          }
        ]
      }
    }
  ]
};
