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
 * Purges all data in destination space
 * @param sourceSpaceApiKey
 * @returns {Promise<number>}
 */
async function clearSpace(sourceSpaceApiKey) {
    // Create URL
        console.log('Clearing destination space')
        const url = `${DEST_ENV_URL}/api/folder/root?deleteAll=true`;
        // Export old Space contents
        const response = await fetch(url, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${sourceSpaceApiKey}`,
                "Content-Type": "application/json"
            }
        })

        if (response.ok) {
            console.log('Destination space cleared')
        }
        else {
            throw Error(`Error occurred during clearing the space: ${response.status} ${response.statusText}`)
        }
}



