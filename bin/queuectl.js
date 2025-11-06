#!/usr/bin/env node

import { Command } from 'commander';
import { enqueueJob } from '../src/jobQueue.js';

const program = new Command();

program
.name('queuectl')
.description('Local job queue CLI')
.version('0.1.0');

// enqueue command
program
.command('enqueue')
.argument('<jobJson>', 'Job JSON payload')
.description('Add a new job to the queue')
.action(async (jobJson) => {
    try {
    const job = JSON.parse(jobJson);
    const added = await enqueueJob(job);
    console.log(`🟢 Job enqueued: ${added.id}`);
    } catch (err) {
    console.error("🔴 Failed to enqueue job:", err.message);
    }
});

await program.parseAsync(process.argv);


