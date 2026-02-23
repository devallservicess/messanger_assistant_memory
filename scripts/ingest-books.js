const path = require('path');
const ragService = require('../services/rag-service');

async function ingest() {
    try {
        const booksPath = path.join(__dirname, '..', 'rag-data', 'books.json');
        console.log(`Ingesting books from ${booksPath}...`);

        await ragService.processFile(booksPath, 'books.json');

        console.log('Successfully ingested books dataset!');
    } catch (err) {
        console.error('Error ingesting books:', err);
    }
}

ingest();
