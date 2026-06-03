const args = process.argv.slice(2);

/**
 * Destination space management api key. It identifies DecisionRules space
 * @type {string}
 */
const DEST_SPACE_MANAGEMENT_APIKEY = process.env.DEST_SPACE_MANAGEMENT_APIKEY || args[1];

/**
 * Source DecisionRules environment url. Example: // example: https://api.decisionrules.io
 * @type {string}
 */
const DEST_ENV_URL = process.env.DEST_ENV_URL || args[0];


// START
(async () => {

    try {
        if (!DEST_ENV_URL) {
            console.error("Set ENV variable SOURCE_ENV_URL. Example: https://api.decisionrules.io");
            process.exit(-1)
        }

        if (!DEST_SPACE_MANAGEMENT_APIKEY) {
            console.error("Set ENV variable SOURCE_SPACE_APIKEY.");
            process.exit(-1)
        }

        await clearSpace(DEST_SPACE_MANAGEMENT_APIKEY);
        return 0

    } catch(e) {
        console.error('Error:', e)
        process.exit(-1)
    }
})();


/**
 * Purges all data in destination space.
 *
 * Two passes:
 *  1. DELETE /api/folder/root?deleteAll=true — walks root's children and their
 *     descendants in the folder tree. This is the "official" clear.
 *  2. Vacuum any rules left in space.itemIds that the folder-tree walk missed.
 *     These are orphans created by past failed imports (where the per-rule
 *     subscriber chain silently dropped folder linkage). Because they have no
 *     folder-tree node, the deleteAll walk never reaches them, and they
 *     accumulate across clears unless something explicitly removes them.
 *
 * @param sourceSpaceApiKey
 * @returns {Promise<number>}
 */
async function clearSpace(sourceSpaceApiKey) {
    console.log('Clearing destination space')
    const authHeaders = {
        "Authorization": `Bearer ${sourceSpaceApiKey}`,
        "Content-Type": "application/json"
    }

    // Pass 1: the folder-tree based clear.
    const url = `${DEST_ENV_URL}/api/folder/root?deleteAll=true`;
    const response = await fetch(url, {
        method: "DELETE",
        headers: authHeaders
    })

    if (!response.ok) {
        throw Error(`Error occurred during clearing the space: ${response.status} ${response.statusText}`)
    }
    console.log('Destination space cleared (folder-tree pass)')

    // Pass 2: vacuum any rules the folder-tree walk left behind.
    await vacuumOrphanedRules(authHeaders)
}

/**
 * Lists every rule the space still knows about via GET /space/items (which
 * queries by space.itemIds, so it sees orphans), and deletes them one by one
 * via DELETE /rule/:baseId. Iterates because a single rule can have multiple
 * versions and the delete endpoint removes one version at a time.
 *
 * @param {object} authHeaders
 * @returns {Promise<void>}
 */
async function vacuumOrphanedRules(authHeaders) {
    const MAX_VACUUM_PASSES = 5
    const apiBase = `${DEST_ENV_URL}/api`

    for (let pass = 1; pass <= MAX_VACUUM_PASSES; pass++) {
        const listResponse = await fetch(`${apiBase}/space/items`, {
            method: "GET",
            headers: authHeaders
        })
        if (!listResponse.ok) {
            const body = await listResponse.text().catch(() => '')
            throw new Error(
                `Vacuum: GET /space/items failed on pass ${pass}: ` +
                `${listResponse.status} ${listResponse.statusText} ${body}`
            )
        }
        const items = await listResponse.json()
        if (!Array.isArray(items)) {
            throw new Error(`Vacuum: GET /space/items returned non-array: ${JSON.stringify(items)}`)
        }

        if (items.length === 0) {
            if (pass === 1) {
                console.log('Vacuum: no orphan rules to clean up')
            } else {
                console.log(`Vacuum: space empty after ${pass - 1} pass(es)`)
            }
            return
        }

        console.log(
            `Vacuum pass ${pass}/${MAX_VACUUM_PASSES}: ${items.length} rule(s) survived the clear, ` +
            `deleting individually: ${items.map((r) => r.name || r.baseId).join(', ')}`
        )

        // Delete by baseId rather than by ruleAlias. If two rules share an
        // alias (which is exactly the orphan-accumulation pattern), the
        // identifier middleware errors with "possible duplication in rule
        // aliases" — baseId is always unique.
        for (const item of items) {
            if (!item.baseId) {
                console.warn(`Vacuum: skipping item with no baseId: ${JSON.stringify(item)}`)
                continue
            }
            const deleteResponse = await fetch(
                `${apiBase}/rule/${encodeURIComponent(item.baseId)}`,
                { method: "DELETE", headers: authHeaders }
            )
            if (!deleteResponse.ok) {
                // Don't throw on a single failure — let the next pass retry it.
                const body = await deleteResponse.text().catch(() => '')
                console.warn(
                    `Vacuum: DELETE /rule/${item.baseId} returned ` +
                    `${deleteResponse.status} ${deleteResponse.statusText} ${body}`
                )
            }
        }
    }

    // Final verification — refuse to claim success if anything is still there.
    const finalResponse = await fetch(`${apiBase}/space/items`, {
        method: "GET",
        headers: authHeaders
    })
    if (finalResponse.ok) {
        const remaining = await finalResponse.json()
        if (Array.isArray(remaining) && remaining.length > 0) {
            throw new Error(
                `Vacuum: ${remaining.length} rule(s) still present after ${MAX_VACUUM_PASSES} passes. ` +
                `Remaining: ${JSON.stringify(remaining.map((r) => ({ baseId: r.baseId, name: r.name, version: r.version })))}`
            )
        }
    }
}



