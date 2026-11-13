"""Supported natural satellites and their parent-body reference centers.

Horizons IDs are target IDs. Centers use Horizons' 500@<body-id> syntax:
500@399 = Earth center, 500@499 = Mars center, etc.
"""
BODIES = {
    "moon": {
        "name": "Earth's Moon", "id": "301",
        "parent": "Earth", "center": "500@399",
    },
    "phobos": {
        "name": "Phobos", "id": "401",
        "parent": "Mars", "center": "500@499",
    },
    "deimos": {
        "name": "Deimos", "id": "402",
        "parent": "Mars", "center": "500@499",
    },
    "io": {
        "name": "Io", "id": "501",
        "parent": "Jupiter", "center": "500@599",
    },
    "europa": {
        "name": "Europa", "id": "502",
        "parent": "Jupiter", "center": "500@599",
    },
    "ganymede": {
        "name": "Ganymede", "id": "503",
        "parent": "Jupiter", "center": "500@599",
    },
    "callisto": {
        "name": "Callisto", "id": "504",
        "parent": "Jupiter", "center": "500@599",
    },
    "enceladus": {
        "name": "Enceladus", "id": "602",
        "parent": "Saturn", "center": "500@699",
    },
    "titan": {
        "name": "Titan", "id": "606",
        "parent": "Saturn", "center": "500@699",
    },
    "triton": {
        "name": "Triton", "id": "801",
        "parent": "Neptune", "center": "500@899",
    },
}
