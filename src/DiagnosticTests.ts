/**
 * DiagnosticTests.ts - Comprehensive test suite for Cyber Canvas features
 *
 * This file contains diagnostic tests to verify:
 * - IOC card parsing (type detection, field extraction)
 * - MITRE tactic/technique extraction
 * - MITRE validation logic
 * - Tactic abbreviation resolution
 *
 * Usage: Call runAllDiagnostics() from the plugin to execute all tests
 */

import { parseIOCNode } from './IOCParser';
import { normalizeTacticName, validateTechniqueTactic, MitreDataset } from './MitreLoader';

export class DiagnosticTests {
    private dataset: MitreDataset | null = null;

    constructor(dataset: MitreDataset | null) {
        this.dataset = dataset;
    }

    /**
     * Run all diagnostic tests and log results
     */
    runAllTests(): void {
        console.log('╔════════════════════════════════════════════════════════════════════╗');
        console.log('║          CYBER CANVAS DIAGNOSTIC TEST SUITE                        ║');
        console.log('╚════════════════════════════════════════════════════════════════════╝');
        console.log('');

        this.testIOCParsing();
        this.testMITREExtraction();
        this.testTacticAbbreviations();
        this.testTechniqueValidation();
        this.testEdgeCases();

        console.log('');
        console.log('╔════════════════════════════════════════════════════════════════════╗');
        console.log('║          DIAGNOSTIC TESTS COMPLETE                                  ║');
        console.log('╚════════════════════════════════════════════════════════════════════╝');
    }

    /**
     * Test IOC card parsing and type detection
     */
    private testIOCParsing(): void {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('TEST 1: IOC Card Parsing');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const testCards = [
            {
                name: 'IP Address Card',
                text: `<div class="ioc-card-header">IP Address</div>
IP: 192.168.1.1

------------
Time of Event: 2024-01-01 12:00:00

------------
Mitre Tactic: EX

------------
Mitre Technique: T1053.005

------------`
            },
            {
                name: 'Command Line Card',
                text: `<div class="ioc-card-header">Command Line</div>
Command: calc.exe

------------
Time of Event: 2024-01-01 12:00:00

------------
Mitre Tactic: EXEC

------------
Mitre Technique: T1059

------------`
            },
            {
                name: 'File Hash Card',
                text: `<div class="ioc-card-header">File Hash</div>
Hash: abc123def456

------------
Time of Event: 2024-01-01 12:00:00

------------
Mitre Tactic: Execution

------------
Mitre Technique: T1204.002

------------`
            }
        ];

        testCards.forEach((testCard, index) => {
            console.log(`\n  Test ${index + 1}: ${testCard.name}`);
            const result = parseIOCNode({ id: `test-${index}`, text: testCard.text });

            if (result) {
                console.log(`    ✓ Type detected: ${result.type}`);
                console.log(`    ✓ Value: ${result.value || '(empty)'}`);
                console.log(`    ✓ Tactic: ${result.tactic || '(empty)'}`);
                console.log(`    ✓ Technique: ${result.technique || '(empty)'}`);
            } else {
                console.log(`    ❌ FAILED: Could not parse card`);
            }
        });
    }

    /**
     * Test MITRE field extraction with various formats
     */
    private testMITREExtraction(): void {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('TEST 2: MITRE Field Extraction');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const testCases = [
            { tactic: 'EX', technique: 'T1053.005', expected: 'Should extract EX and T1053.005' },
            { tactic: 'Execution', technique: 'T1053', expected: 'Should extract full name and parent technique' },
            { tactic: 'CA', technique: 'T1003.001', expected: 'Should extract abbreviation and subtechnique' },
            { tactic: 'PRIV', technique: 'T1068 - Exploitation for Privilege Escalation', expected: 'Should extract with name' },
            { tactic: '', technique: 'T1053.005', expected: 'Should handle empty tactic' },
            { tactic: 'EX', technique: '', expected: 'Should handle empty technique' }
        ];

        testCases.forEach((testCase, index) => {
            console.log(`\n  Test ${index + 1}: ${testCase.expected}`);
            const text = `Mitre Tactic: ${testCase.tactic}\n\nMitre Technique: ${testCase.technique}\n`;
            const result = parseIOCNode({
                id: `mitre-test-${index}`,
                text: `<div>IP Address</div>\nIP: 1.1.1.1\n${text}`
            });

            if (result) {
                console.log(`    Tactic: "${result.tactic}" (expected: "${testCase.tactic}")`);
                console.log(`    Technique: "${result.technique}" (expected: "${testCase.technique}")`);

                if (result.tactic === testCase.tactic.toUpperCase() &&
                    result.technique === testCase.technique.toUpperCase()) {
                    console.log(`    ✓ PASS`);
                } else {
                    console.log(`    ❌ MISMATCH`);
                }
            } else {
                console.log(`    ❌ FAILED: Could not parse`);
            }
        });
    }

    /**
     * Test tactic abbreviation resolution
     */
    private testTacticAbbreviations(): void {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('TEST 3: Tactic Abbreviation Resolution');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (!this.dataset) {
            console.log('  ⚠ SKIPPED: Dataset not loaded');
            return;
        }

        const testAbbreviations = [
            { input: 'EX', expected: 'Execution' },
            { input: 'EXEC', expected: 'Execution' },
            { input: 'CA', expected: 'Credential Access' },
            { input: 'CRED', expected: 'Credential Access' },
            { input: 'PE', expected: 'Privilege Escalation' },
            { input: 'PRIV', expected: 'Privilege Escalation' },
            { input: 'IA', expected: 'Initial Access' },
            { input: 'C2', expected: 'Command and Control' },
            { input: 'EXFIL', expected: 'Exfiltration' },
            { input: 'DE', expected: 'Defense Evasion' },
            { input: 'INVALID', expected: null }
        ];

        testAbbreviations.forEach((test, index) => {
            console.log(`\n  Test ${index + 1}: "${test.input}" → "${test.expected || 'null'}"`);
            const tacticId = normalizeTacticName(test.input, this.dataset!);

            if (tacticId) {
                const tactic = this.dataset!.tactics[tacticId];
                console.log(`    Resolved to: ${tactic.name} (${tacticId})`);

                if (tactic.name === test.expected) {
                    console.log(`    ✓ PASS`);
                } else {
                    console.log(`    ❌ MISMATCH: Expected ${test.expected}`);
                }
            } else {
                if (test.expected === null) {
                    console.log(`    ✓ PASS: Correctly returned null for invalid input`);
                } else {
                    console.log(`    ❌ FAILED: Could not resolve, expected ${test.expected}`);
                }
            }
        });
    }

    /**
     * Test technique validation logic
     */
    private testTechniqueValidation(): void {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('TEST 4: Technique Validation');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (!this.dataset) {
            console.log('  ⚠ SKIPPED: Dataset not loaded');
            return;
        }

        const testCases = [
            { technique: 'T1053.005', tactic: 'EX', expected: 'valid' },
            { technique: 'T1053.005', tactic: 'Execution', expected: 'valid' },
            { technique: 'T1053.005', tactic: 'EXFIL', expected: 'mismatch' },
            { technique: 'T9999', tactic: 'EX', expected: 'unknown_technique' },
            { technique: 'T1053.005', tactic: 'INVALID', expected: 'unknown_tactic' },
            { technique: 'T1566', tactic: 'IA', expected: 'valid' },
            { technique: 'T1566.001', tactic: 'IA', expected: 'valid' }
        ];

        testCases.forEach((test, index) => {
            console.log(`\n  Test ${index + 1}: ${test.technique} + ${test.tactic} → ${test.expected}`);
            const result = validateTechniqueTactic(test.technique, test.tactic, this.dataset!);

            console.log(`    Severity: ${result.severity}`);
            if (result.message) {
                console.log(`    Message: ${result.message}`);
            }

            if (result.severity === test.expected) {
                console.log(`    ✓ PASS`);
            } else {
                console.log(`    ❌ FAILED: Expected ${test.expected}, got ${result.severity}`);
            }
        });
    }

    /**
     * Test edge cases and error handling
     */
    private testEdgeCases(): void {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('TEST 5: Edge Cases');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const edgeCases = [
            {
                name: 'Empty text',
                text: '',
                expectNull: true
            },
            {
                name: 'No IOC type',
                text: 'Random text without IOC type',
                expectNull: true
            },
            {
                name: 'Mixed case technique',
                text: `<div>IP Address</div>\nIP: 1.1.1.1\nMitre Tactic: ex\nMitre Technique: t1053.005`,
                expectNull: false
            },
            {
                name: 'Technique with description',
                text: `<div>IP Address</div>\nIP: 1.1.1.1\nMitre Tactic: EX\nMitre Technique: T1053.005 - Scheduled Task`,
                expectNull: false
            },
            {
                name: 'Extra whitespace',
                text: `<div>IP Address</div>\nIP: 1.1.1.1\nMitre Tactic:    EX    \nMitre Technique:   T1053.005   `,
                expectNull: false
            }
        ];

        edgeCases.forEach((test, index) => {
            console.log(`\n  Test ${index + 1}: ${test.name}`);
            const result = parseIOCNode({ id: `edge-${index}`, text: test.text });

            if (test.expectNull) {
                if (result === null) {
                    console.log(`    ✓ PASS: Correctly returned null`);
                } else {
                    console.log(`    ❌ FAILED: Should have returned null`);
                }
            } else {
                if (result !== null) {
                    console.log(`    ✓ PASS: Successfully parsed`);
                    console.log(`    Tactic: ${result.tactic}`);
                    console.log(`    Technique: ${result.technique}`);
                } else {
                    console.log(`    ❌ FAILED: Should have parsed successfully`);
                }
            }
        });
    }
}

/**
 * Run diagnostic tests (call from plugin initialization or command)
 */
export function runDiagnostics(dataset: MitreDataset | null): void {
    const tests = new DiagnosticTests(dataset);
    tests.runAllTests();
}
