import * as assert from 'assert';
import { StatusBarProvider } from '../../../../components/remoteTracing/statusBarProvider';

suite('StatusBarProvider', () => {
  let statusBarProvider: StatusBarProvider;

  teardown(() => {
    if (statusBarProvider) {
      statusBarProvider.dispose();
    }
  });

  test('should create status bar provider', () => {
    statusBarProvider = new StatusBarProvider();
    assert.ok(statusBarProvider);
  });

  test('should update display with explicit enable parameter - enabled', async () => {
    statusBarProvider = new StatusBarProvider();
    
    // Test with explicit enable = true
    await statusBarProvider.updateDisplay(true);
    
    // We can't easily test the private statusBarItem properties without exposing them,
    // but we can verify the method doesn't throw
    assert.ok(true, 'updateDisplay with enable=true should not throw');
  });

  test('should update display with explicit enable parameter - disabled', async () => {
    statusBarProvider = new StatusBarProvider();
    
    // Test with explicit enable = false
    await statusBarProvider.updateDisplay(false);
    
    // We can't easily test the private statusBarItem properties without exposing them,
    // but we can verify the method doesn't throw
    assert.ok(true, 'updateDisplay with enable=false should not throw');
  });

  test('should update display without enable parameter', async () => {
    statusBarProvider = new StatusBarProvider();
    
    // Test without enable parameter (defaults to undefined, shows disabled state)
    await statusBarProvider.updateDisplay();
    
    // We can't easily test the private statusBarItem properties without exposing them,
    // but we can verify the method doesn't throw
    assert.ok(true, 'updateDisplay without enable parameter should not throw');
  });

  test('should update display with undefined enable parameter', async () => {
    statusBarProvider = new StatusBarProvider();
    
    // Test with explicit undefined (shows disabled state)
    await statusBarProvider.updateDisplay(undefined);
    
    // We can't easily test the private statusBarItem properties without exposing them,
    // but we can verify the method doesn't throw
    assert.ok(true, 'updateDisplay with enable=undefined should not throw');
  });

  test('should handle errors gracefully', async () => {
    statusBarProvider = new StatusBarProvider();
    
    // The current implementation doesn't have external dependencies that could throw,
    // but we can still test that the method completes without throwing
    await statusBarProvider.updateDisplay();
    
    assert.ok(true, 'updateDisplay should handle errors gracefully');
  });

  test('should dispose properly', () => {
    statusBarProvider = new StatusBarProvider();
    
    // Should not throw when disposing
    statusBarProvider.dispose();
    
    assert.ok(true, 'dispose should not throw');
  });
}); 