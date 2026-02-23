const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const API_URL = 'http://localhost:3000/api';
const TEST_FILE_PATH = path.join(__dirname, 'test-delete.txt');

async function runTest() {
    try {
        console.log('Starting verification test...');

        // 1. Create a dummy test file
        fs.writeFileSync(TEST_FILE_PATH, 'This is a test document for deletion verification.\nIt has multiple lines.\nTo ensure multiple chunks might be created.');
        console.log('Created test file:', TEST_FILE_PATH);

        // 2. Get initial document count
        let response = await axios.get(`${API_URL}/status`);
        const initialCount = response.data.vectorStoreSize;
        console.log('Initial document count:', initialCount);

        // 3. Upload the file
        const form = new FormData();
        form.append('file', fs.createReadStream(TEST_FILE_PATH));

        response = await axios.post(`${API_URL}/upload`, form, {
            headers: {
                ...form.getHeaders()
            }
        });

        if (!response.data.success) {
            throw new Error('Upload failed');
        }

        const sourceId = response.data.data.id;
        console.log('Uploaded file. Source ID:', sourceId);

        // 4. Get count after upload
        response = await axios.get(`${API_URL}/status`);
        const countAfterUpload = response.data.vectorStoreSize;
        console.log('Count after upload:', countAfterUpload);

        if (countAfterUpload <= initialCount) {
            throw new Error('Document count did not increase after upload');
        }

        const addedDocs = countAfterUpload - initialCount;
        console.log(`Added ${addedDocs} documents.`);

        // 5. Delete the file
        response = await axios.delete(`${API_URL}/data/${sourceId}`);
        if (!response.data.success) {
            throw new Error('Delete failed');
        }
        console.log('Deleted data source.');

        // 6. Get count after delete
        response = await axios.get(`${API_URL}/status`);
        const countAfterDelete = response.data.vectorStoreSize;
        console.log('Count after delete:', countAfterDelete);

        // 7. Verify
        if (countAfterDelete === initialCount) {
            console.log('✅ TEST PASSED: Document count returned to initial value.');
        } else {
            console.error('❌ TEST FAILED: Document count did not return to initial value.');
            console.error(`Expected: ${initialCount}, Actual: ${countAfterDelete}`);
            process.exit(1);
        }

    } catch (error) {
        console.error('Test failed with error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
        process.exit(1);
    } finally {
        // Cleanup
        if (fs.existsSync(TEST_FILE_PATH)) {
            fs.unlinkSync(TEST_FILE_PATH);
            console.log('Cleaned up test file.');
        }
    }
}

runTest();
