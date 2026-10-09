/**
 * test/launcher.cs
 * Source of chatterly-test.exe: a tiny launcher that runs the project's single end-to-end test (test/run.mjs)
 * from the project root, shows its output and exits with the same exit code (0 means everything passed).
 * Build it again with: powershell -File test/build-exe.ps1
 */
using System;
using System.Diagnostics;
using System.IO;

public static class Program
{
    /// <summary>Runs "node test/run.mjs" in the project root and returns its exit code.</summary>
    public static int Main(string[] args)
    {
        string folder = AppDomain.CurrentDomain.BaseDirectory;
        string root = Path.GetFullPath(Path.Combine(folder, ".."));
        ProcessStartInfo info = new ProcessStartInfo("cmd.exe", "/c node test/run.mjs");
        info.WorkingDirectory = root;
        info.UseShellExecute = false;
        Process process = Process.Start(info);
        process.WaitForExit();
        Console.WriteLine();
        Console.WriteLine(process.ExitCode == 0 ? "ALL TESTS PASSED" : "TESTS FAILED");
        // Double-clicked from Explorer: keep the window open so the result can be read.
        if (args.Length == 0 && !Console.IsInputRedirected)
        {
            Console.WriteLine("Press any key to close...");
            Console.ReadKey(true);
        }
        return process.ExitCode;
    }
}
