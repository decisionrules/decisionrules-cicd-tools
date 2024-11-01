const fs = require('fs');
const args = process.argv.slice(2);

/**
 * Source space management api key. It identifies DecisionRules space
 * @type {string}
 */
const SOURCE_SPACE_MANAGEMENT_APIKEY = process.env.SOURCE_SPACE_MANAGEMENT_APIKEY || args[2];

/**
 * Source DecisionRules environment url. Example: // example: https://api.decisionrules.io
 * @type {string}
 */
const SOURCE_ENV_URL = process.env.SOURCE_ENV_URL || args[1];





// START
(async () => {
    try {
        const exportFilePath = args[0]


        // check that export file path is specified
        if (!exportFilePath) {
            console.log('Please specify export file path')
            process.exit(-1)
        } else {
            console.log('Exporting to file:', exportFilePath)
        }


        if (!SOURCE_ENV_URL) {
            console.error("Set ENV variable SOURCE_ENV_URL. Example: https://api.decisionrules.io");
            process.exit(-1)
        }

        if (!SOURCE_SPACE_MANAGEMENT_APIKEY) {
            console.error("Set ENV variable SOURCE_SPACE_APIKEY.");
            process.exit(-1)
        }

        const exportedSpace = await exportSpace(SOURCE_SPACE_MANAGEMENT_APIKEY);
        fs.writeFileSync(exportFilePath, JSON.stringify(exportedSpace))
        console.log('Export successfully written to file:', exportFilePath)
        return 0
    } catch(e) {
        console.error('Error :', e)
        process.exit(-1)
    }
})();


async function exportSpace(sourceSpaceApiKey) {
    // Create URL
        const url = `${SOURCE_ENV_URL}/api/folder/`;

        // Export old Space contents
        const exportResponse = await fetch(url + 'export/root', {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${sourceSpaceApiKey}`,
                "Content-Type": "application/json"
            }
        })

        if (!exportResponse.ok) {
            throw new Error(`Failed to download folder: ${exportResponse.body} ${exportResponse.statusText}  ${exportResponse.status}`)
        }

        // Convert response to json
        return await exportResponse.json()
}



