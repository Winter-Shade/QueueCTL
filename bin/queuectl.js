#!/usr/bin/env node

import { Command } from 'commander';
import { enqueueJob, listJobs } from '../src/jobQueue.js';
import {startWorkers, stopWorkers} from '../src/worker.js'

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

// list command
program
    .command('list')
    .description('List jobs by state')
    .option('--state <state>', 'Filter by state (pending, processing, completed, failed, dead)')
    .action(async (opts) => {
      const jobs = await listJobs(opts.state);
      if (!jobs.length) {
        console.log('⏺️ No jobs found.');
        return;
      }

      console.log(`Jobs${opts.state ? ` [state=${opts.state}]` : ''}:`);
      for (const job of jobs) {
        console.log(
          `- ${job.id} | ${job.state} | command="${job.command}" | attempts=${job.attempts}`
        );
      }
    });

    // Worker Commands
  const workerCmd = program.command('worker').description('Manage worker processes');

  workerCmd
    .command('start')
    .option('--count <count>', 'Number of workers to start', '1')
    .description('Start worker processes')
    .action(async (opts) => {
      await startWorkers(Number(opts.count));
    });

  workerCmd
    .command('stop')
    .description('Stop all running workers')
    .action(async () => {
      await stopWorkers();
    });


await program.parseAsync(process.argv);


