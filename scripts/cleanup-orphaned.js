const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'rag-data');
const VECTOR_STORE_PATH = path.join(DATA_DIR, 'vector-store.json');
const SOURCES_PATH = path.join(DATA_DIR, 'sources.json');

function cleanupOrphaned() {
    try {
        console.log('Starting cleanup of orphaned documents...');

        if (!fs.existsSync(VECTOR_STORE_PATH) || !fs.existsSync(SOURCES_PATH)) {
            console.log('Data files not found. Nothing to clean.');
            return;
        }

        const vectorStoreData = JSON.parse(fs.readFileSync(VECTOR_STORE_PATH, 'utf8'));
        const sourcesData = JSON.parse(fs.readFileSync(SOURCES_PATH, 'utf8'));

        const validSourceNames = new Set(sourcesData.map(s => s.name));
        console.log(`Found ${validSourceNames.size} valid data sources.`);

        const documents = vectorStoreData.documents || [];
        const embeddings = vectorStoreData.embeddings || [];
        const metadata = vectorStoreData.metadata || [];

        console.log(`Current document count: ${documents.length}`);

        const newDocuments = [];
        const newEmbeddings = [];
        const newMetadata = [];

        let keptCount = 0;
        let removedCount = 0;

        for (let i = 0; i < documents.length; i++) {
            const docMetadata = metadata[i] || {};
            const sourceName = docMetadata.source;

            if (sourceName && validSourceNames.has(sourceName)) {
                newDocuments.push(documents[i]);
                newEmbeddings.push(embeddings[i]);
                newMetadata.push(metadata[i]);
                keptCount++;
            } else {
                removedCount++;
            }
        }

        console.log(`Removed ${removedCount} orphaned documents.`);
        console.log(`Kept ${keptCount} valid documents.`);

        const newVectorStoreData = {
            documents: newDocuments,
            embeddings: newEmbeddings,
            metadata: newMetadata
        };

        fs.writeFileSync(VECTOR_STORE_PATH, JSON.stringify(newVectorStoreData));
        console.log('Updated vector-store.json saved.');

    } catch (error) {
        console.error('Cleanup failed:', error.message);
    }
}

cleanupOrphaned();
