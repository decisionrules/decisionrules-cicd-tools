const args = process.argv.slice(2);

/**
 * Destination space management api key. It identifies DecisionRules space
 * @type {string}
 */
const DEST_SPACE_MANAGEMENT_APIKEY = process.env.DEST_SPACE_MANAGEMENT_APIKEY || args[2];

/**
 * Source DecisionRules environment url. Example: // example: https://api.decisionrules.io
 * @type {string}
 */
const DEST_ENV_URL = process.env.DEST_ENV_URL || args[1];


// START
(async () => {

    try {
        const args = process.argv.slice(2);
        const importFilePath = args[0]

        if (!importFilePath) {
            console.log('Please specify file to import.')
            process.exit(-1)
        } else {
            console.log('Importing from file:', importFilePath)
        }

        if (!DEST_ENV_URL) {
            console.error("Set ENV variable SOURCE_ENV_URL. Example: https://api.decisionrules.io");
            process.exit(-1)
        }

        if (!DEST_SPACE_MANAGEMENT_APIKEY) {
            console.error("Set ENV variable SOURCE_SPACE_APIKEY.");
            process.exit(-1)
        }

        const rf = await import('fs/promises');
        const jsonString = ((await rf.readFile(importFilePath)).toString('utf8'))

        return await importSpace(DEST_SPACE_MANAGEMENT_APIKEY, jsonString);
    } catch (e) {
        console.error('Error:', e)
        process.exit(-1)
    }
})();



async function assertOk(response, label) {
    if (response.ok) return
    let body = ''
    try { body = await response.text() } catch { /* ignore */ }
    throw new Error(`${label} failed: ${response.status} ${response.statusText} ${body}`)
}

function toMoveNode(child) {
    if (child.type === 'FOLDER') {
        return { id: child.id, type: 'FOLDER' }
    }
    if (child.type === 'RULE') {
        const node = { type: 'RULE', baseId: child.baseId }
        if (child.version !== undefined) node.version = child.version
        return node
    }
    throw new Error(`Unexpected node type in wrapper: ${JSON.stringify(child)}`)
}

async function importSpace(destinationSpaceApiKey, importJsonData) {
    // Create URL
    try {
        const url = `${DEST_ENV_URL}/api/folder/`;
        const authHeaders = {
            "Authorization": `Bearer ${destinationSpaceApiKey}`,
            "Content-Type": "application/json"
        }

        // Import into a wrapper folder under root
        const importResponse = await fetch(url + 'import/root', {
            method: "POST",
            headers: authHeaders,
            body: importJsonData
        })
        await assertOk(importResponse, 'Import')


        const createdFolderIdObject = await importResponse.json()
        const createdFolderId = createdFolderIdObject.folderNode
        if (!createdFolderId) {
            throw new Error(`Import response is missing folderNode: ${JSON.stringify(createdFolderIdObject)}`)
        }

        // Move every direct child of the wrapper out to root so the imported
        // hierarchy ends up under root instead of nested under a wrapper.
        //
        // We loop because concurrent operations on the same space (e.g. a UI
        // "refresh folder structure" calling PATCH /folder/fix while the
        // import is still running) can re-attach children to the wrapper
        // after our move lands. Each iteration re-reads the wrapper's
        // current children and moves whatever is there, then re-verifies.
        // We refuse to delete the wrapper until it is empty, because
        // DELETE cascades through descendants and would silently wipe rules.
        const MAX_MOVE_ATTEMPTS = 5
        const RETRY_DELAY_MS = 200
        let lastChildren = null
        for (let attempt = 1; attempt <= MAX_MOVE_ATTEMPTS; attempt++) {
            const structureResponse = await fetch(url + createdFolderId, {
                method: "GET",
                headers: authHeaders
            })
            await assertOk(structureResponse, `Get wrapper structure (attempt ${attempt})`)
            const structure = await structureResponse.json()
            const children = structure.children || []

            if (children.length === 0) {
                lastChildren = []
                break
            }

            lastChildren = children
            console.log(
                `Move attempt ${attempt}/${MAX_MOVE_ATTEMPTS}: wrapper has ${children.length} child(ren), moving to root`
            )

            const moveResponse = await fetch(url + 'move', {
                method: "PUT",
                headers: authHeaders,
                body: JSON.stringify({ targetId: 'root', nodes: children.map(toMoveNode) })
            })
            await assertOk(moveResponse, `Move wrapper children to root (attempt ${attempt})`)

            // Small backoff so a concurrent fix/refresh on a tight cadence
            // has a chance to settle before our next verify read.
            if (attempt < MAX_MOVE_ATTEMPTS) {
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
            }
        }

        if (lastChildren && lastChildren.length > 0) {
            throw new Error(
                `Wrapper folder ${createdFolderId} still has ${lastChildren.length} child(ren) ` +
                `after ${MAX_MOVE_ATTEMPTS} move attempts; refusing to delete it to avoid cascading ` +
                `rule loss. This usually means another writer (e.g. /folder/fix) was racing with the ` +
                `import — try again with no UI activity on the target space. ` +
                `Remaining children: ${JSON.stringify(lastChildren)}`
            )
        }

        const deleteResponse = await fetch(url + createdFolderId, {
            method: "DELETE",
            headers: authHeaders,
        })
        await assertOk(deleteResponse, 'Delete empty wrapper folder')
        console.log('Migration Completed Successfully')

        return 0
    }
    catch(e) {
        console.error(`Error occurred during migration: ${e.message}`)
        throw e
    }
}



