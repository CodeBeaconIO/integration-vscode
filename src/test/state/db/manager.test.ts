import * as assert from 'assert';
import { DBManager } from '../../../state/db/manager';
import { newDbEventEmitter } from '../../../eventEmitter';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

suite('DBManager Test Suite', () => {
    const InitDelay = 150;
    const testDir = path.join(__dirname, '../../../../.code-beacon/test');
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }
    let dbManager: DBManager;
    let refreshPath: string;

    teardown(() => {
        fs.unlinkSync(refreshPath);
    });

    test('should emit newDbEvent when refresh file is created', function(done) {
        this.timeout(15000); // create events are only polled every 5000ms

        refreshPath = path.join(testDir, 'refresh_' + crypto.randomBytes(16).toString('hex'));
        dbManager = new DBManager(refreshPath);
        dbManager.startWatching();
        const disposable = newDbEventEmitter.event(() => {
            assert.ok(true, 'newDbEvent should be fired');
            dbManager.stopWatching();
            disposable.dispose();
            done();
        });
        
        setTimeout(() => {
            fs.writeFileSync(refreshPath, 'initial content');
        }, InitDelay); // The fileSystemWatcher seems to take ~4ms to actually start watching (on my machine), however I've still had flakey tests when this timeout is set to 30ms.
    });

    test('should emit newDbEvent when refresh file is updated', function(done) {
        refreshPath = path.join(testDir, 'refresh_' + crypto.randomBytes(16).toString('hex'));
        fs.writeFileSync(refreshPath, 'initial content');
        dbManager = new DBManager(refreshPath);
        dbManager.startWatching();

        setTimeout(() => {
            fs.writeFileSync(refreshPath, 'updated content');
        }, InitDelay);

        const disposable = newDbEventEmitter.event(() => {
            assert.ok(true, 'newDbEvent should be fired');
            dbManager.stopWatching();
            disposable.dispose();
            done();
        });
    });

    test('should stop watching when stopWatching is called', (done) => {
        refreshPath = path.join(testDir, 'refresh_' + crypto.randomBytes(16).toString('hex'));
        fs.writeFileSync(refreshPath, 'initial content');
        dbManager = new DBManager(refreshPath);
        dbManager.startWatching();

        setTimeout(() => {
            dbManager.stopWatching();
            fs.writeFileSync(refreshPath, 'updated content');
        }, InitDelay);

        const disposable = newDbEventEmitter.event(() => {
            clearTimeout(timeoutId);
            disposable.dispose();
            assert.fail('newDbEventEmitter should not be fired after stopping');
        });
        
        const timeoutId = setTimeout(() => {
            assert.ok(true, 'No events were fired after stopping');
            disposable.dispose();
            done();
        }, 300);
    });
}); 