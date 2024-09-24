/**
 * Destination space management api key. It identifies DecisionRules space
 * @type {string}
 */
const DEST_SPACE_MANAGEMENT_APIKEY = process.env.DEST_SPACE_MANAGEMENT_APIKEY;

/**
 * Source DecisionRules environment url. Example: // example: https://api.decisionrules.io
 * @type {string}
 */
const DEST_ENV_URL = process.env.DEST_ENV_URL;


// START
(async () => {

    try {
        if (!DEST_ENV_URL) {
            console.error("Set ENV variable SOURCE_ENV_URL. Example: https://api.decisionrules.io");
            return
        }

        if (!DEST_SPACE_MANAGEMENT_APIKEY) {
            console.error("Set ENV variable SOURCE_SPACE_APIKEY.");
            return
        }

        return await clearSpace(DEST_SPACE_MANAGEMENT_APIKEY);
    } catch(e) {
        console.error('Error:', e)
    }
})();


/**
 * Purges all data in destination space
 * @param sourceSpaceApiKey
 * @returns {Promise<number>}
 */
async function clearSpace(sourceSpaceApiKey) {
    // Create URL
    try {
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

        if (response.status === 200) {
            console.log('Destination space cleared')
            return 0
        }
        else {
            throw Error(`Error occurred during clear space: ${response.status} ${response.statusText}`)
        }

    }
    catch(e) {
        console.error(`Error occurred during clearing space: ${e.message}`)
        throw e
    }
}



