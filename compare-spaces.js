const fs = require('fs');
const path = require('path');

/**
 * Traverses the rule tree structure and creates a map of rules
 * @param {Object} jsonData - The JSON export data
 * @returns {Map} Map with key as ruleAlias_version and value as {state, path}
 */
function createRuleMap(jsonData) {
    const ruleMap = new Map();
    
    // First, create a lookup for all rules by their baseId
    const rulesById = {};
    if (jsonData.export?.data?.rules) {
        jsonData.export.data.rules.forEach(rule => {
            rulesById[rule.baseId] = rule;
        });
    }
    
    // Recursive function to traverse the tree
    function traverse(node, currentPath = []) {
        if (!node) return;
        
        // Check if this node represents a rule
        if (node.type === 'RULE' && node.baseId && node.version) {
            const rule = rulesById[node.baseId];
            if (rule) {
                const key = `${node.ruleAlias}_${node.version}`;
                const path = [...currentPath, node.name].join('/');

                // Clone the rule to avoid modifying original
                const ruleCopy = JSON.parse(JSON.stringify(rule));

                // Delete attributes that change on import
                delete ruleCopy.createdIn;
                delete ruleCopy.lastUpdate;
                delete ruleCopy.ruleId;
                delete ruleCopy.baseId;
                delete ruleCopy.compositionId;

                if (ruleCopy.type === 'composition') {
                    if (ruleCopy.dataTree?.children) {
                        for (let i = 0; i < ruleCopy.dataTree.children.length; i++) {
                            delete ruleCopy.dataTree.children[i].baseId;
                        }
                    }
                    
                    if (ruleCopy.visualEditorData?.drawflow?.Home?.data) {
                        const visEditorKeys = Object.keys(ruleCopy.visualEditorData.drawflow.Home.data);
                        for (const key of visEditorKeys) {
                            delete ruleCopy.visualEditorData.drawflow.Home.data[key].data;
                        }
                    }
                }
                
                ruleMap.set(key, {
                    state: JSON.stringify(ruleCopy),
                    path: path
                });
            }
        }
        
        // Traverse children
        if (node.children && Array.isArray(node.children)) {
            node.children.forEach(child => {
                const newPath = node.type === 'ROOT' ? ['ROOT'] : [...currentPath, node.name];
                traverse(child, newPath);
            });
        }
    }
    
    // Start traversal from the root structure
    if (jsonData.export?.data?.structure) {
        traverse(jsonData.export.data.structure);
    }
    
    return ruleMap;
}

/**
 * Compares two rule maps and returns comparison results
 * @param {Map} mapA - First rule map
 * @param {Map} mapB - Second rule map (will be modified)
 * @returns {Object} Comparison results
 */
function compareRuleMaps(mapA, mapB) {
    const results = {
        identical: [],          // Rules that are exactly the same
        differentOnly: [],      // Rules with different content but same path
        movedOnly: [],         // Rules with same content but different path
        differentAndMoved: [], // Rules with both different content and path
        onlyInA: [],          // Rules that only exist in map A
        onlyInB: []           // Rules that only exist in map B (after comparison)
    };
    
    // Create a copy of mapB to work with
    const mapBCopy = new Map(mapB);
    
    // Loop through map A
    for (const [key, valueA] of mapA) {
        if (mapBCopy.has(key)) {
            const valueB = mapBCopy.get(key);
            
            // Compare states and paths
            const statesDifferent = valueA.state !== valueB.state;
            const pathsDifferent = valueA.path !== valueB.path;
            
            if (statesDifferent && pathsDifferent) {
                // Both content and path are different
                results.differentAndMoved.push({
                    key: key,
                    pathA: valueA.path,
                    pathB: valueB.path
                });
            } else if (statesDifferent) {
                // Only content is different
                results.differentOnly.push({
                    key: key,
                    path: valueA.path
                });
            } else if (pathsDifferent) {
                // Only path is different (moved)
                results.movedOnly.push({
                    key: key,
                    pathA: valueA.path,
                    pathB: valueB.path
                });
            } else {
                // Completely identical
                results.identical.push({
                    key: key,
                    path: valueA.path
                });
            }
            
            // Remove from map B copy
            mapBCopy.delete(key);
        } else {
            // Rule only exists in map A
            results.onlyInA.push({
                key: key,
                path: valueA.path
            });
        }
    }
    
    // Any remaining items in mapBCopy are only in map B
    for (const [key, value] of mapBCopy) {
        results.onlyInB.push({
            key: key,
            path: value.path
        });
    }
    
    return results;
}

/**
 * Main function to compare two JSON exports
 * @param {Object} jsonA - First JSON export
 * @param {Object} jsonB - Second JSON export
 * @returns {Object} Complete comparison report
 */
function compareRuleJsons(jsonA, jsonB) {
    console.log('Creating rule map for first JSON...');
    const mapA = createRuleMap(jsonA);
    console.log(`Found ${mapA.size} rules in first JSON`);
    
    console.log('Creating rule map for second JSON...');
    const mapB = createRuleMap(jsonB);
    console.log(`Found ${mapB.size} rules in second JSON`);
    
    console.log('Comparing rule maps...');
    const comparisonResults = compareRuleMaps(mapA, mapB);
    
    // Generate summary
    const summary = {
        totalRulesInA: mapA.size,
        totalRulesInB: mapB.size,
        identicalRules: comparisonResults.identical.length,
        differentRulesOnly: comparisonResults.differentOnly.length,
        movedRulesOnly: comparisonResults.movedOnly.length,
        differentAndMovedRules: comparisonResults.differentAndMoved.length,
        rulesOnlyInA: comparisonResults.onlyInA.length,
        rulesOnlyInB: comparisonResults.onlyInB.length
    };
    
    return {
        summary: summary,
        details: comparisonResults,
        timestamp: new Date().toISOString()
    };
}

/**
 * Helper function to print comparison results in a readable format
 * @param {Object} results - Results from compareRuleJsons
 */
function printComparisonResults(results) {
    console.log('\n=== COMPARISON SUMMARY ===');
    console.log(`Timestamp: ${results.timestamp}`);
    console.log(`Total rules in JSON A: ${results.summary.totalRulesInA}`);
    console.log(`Total rules in JSON B: ${results.summary.totalRulesInB}`);
    console.log(`Identical rules: ${results.summary.identicalRules}`);
    console.log(`Different rules (content changed): ${results.summary.differentRulesOnly}`);
    console.log(`Moved rules (path changed): ${results.summary.movedRulesOnly}`);
    console.log(`Different and moved rules: ${results.summary.differentAndMovedRules}`);
    console.log(`Rules only in A: ${results.summary.rulesOnlyInA}`);
    console.log(`Rules only in B: ${results.summary.rulesOnlyInB}`);
    
    if (results.details.differentOnly.length > 0) {
        console.log('\n=== DIFFERENT RULES (content changed, same path) ===');
        results.details.differentOnly.forEach(diff => {
            console.log(`  ${diff.key} (Path: ${diff.path})`);
        });
    }
    
    if (results.details.movedOnly.length > 0) {
        console.log('\n=== MOVED RULES (same content, different path) ===');
        results.details.movedOnly.forEach(moved => {
            console.log(`  ${moved.key}`);
            console.log(`    From: ${moved.pathA}`);
            console.log(`    To:   ${moved.pathB}`);
        });
    }
    
    if (results.details.differentAndMoved.length > 0) {
        console.log('\n=== DIFFERENT AND MOVED RULES (both content and path changed) ===');
        results.details.differentAndMoved.forEach(changed => {
            console.log(`  ${changed.key}`);
            console.log(`    Path A: ${changed.pathA}`);
            console.log(`    Path B: ${changed.pathB}`);
        });
    }
    
    if (results.details.onlyInA.length > 0) {
        console.log('\n=== RULES ONLY IN JSON A ===');
        results.details.onlyInA.forEach(rule => {
            console.log(`  ${rule.key} (Path: ${rule.path})`);
        });
    }
    
    if (results.details.onlyInB.length > 0) {
        console.log('\n=== RULES ONLY IN JSON B ===');
        results.details.onlyInB.forEach(rule => {
            console.log(`  ${rule.key} (Path: ${rule.path})`);
        });
    }
}

// Main execution - if run directly from command line
if (require.main === module) {
    if (process.argv.length < 4) {
        console.error('Usage: node compare_spaces.js <file1.json> <file2.json> [outputFile.json]');
        process.exit(1);
    }

    const file1 = process.argv[2];
    const file2 = process.argv[3];
    const outputFile = process.argv[4] || 'comparison_results.json';

    try {
        console.log(`Reading first JSON from: ${file1}`);
        const jsonA = JSON.parse(fs.readFileSync(file1, 'utf8'));
        
        console.log(`Reading second JSON from: ${file2}`);
        const jsonB = JSON.parse(fs.readFileSync(file2, 'utf8'));
        
        // Compare the JSONs
        const comparisonResults = compareRuleJsons(jsonA, jsonB);
        
        // Save comparison results to file
        fs.writeFileSync(outputFile, JSON.stringify(comparisonResults, null, 2));
        console.log(`\nComparison results saved to: ${outputFile}`);
        
        // Print results
        printComparisonResults(comparisonResults);
        
        // Exit with non-zero if there are changes
        if (comparisonResults.summary.differentRulesOnly > 0 ||
            comparisonResults.summary.movedRulesOnly > 0 ||
            comparisonResults.summary.differentAndMovedRules > 0 ||
            comparisonResults.summary.rulesOnlyInA > 0 ||
            comparisonResults.summary.rulesOnlyInB > 0) {
            console.log('\n⚠️  Changes detected!');
        } else {
            console.log('\n✅ Files are identical!');
        }
        
    } catch (error) {
        console.error('Error during comparison:', error);
        process.exit(1);
    }
}

module.exports = {
    createRuleMap,
    compareRuleMaps,
    compareRuleJsons,
    printComparisonResults
};