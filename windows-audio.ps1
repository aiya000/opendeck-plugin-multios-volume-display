# COM casting is done inside C# (AudioHelper) because PowerShell can't QueryInterface COM objects directly.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioEndpointVolume {
    int _1(); int _2(); int _3(); int _4();
    int SetMasterVolumeLevelScalar(float f, Guid g);
    int _5();
    int GetMasterVolumeLevelScalar(out float f);
    int _6(); int _7(); int _8(); int _9(); int _10();
    int GetMute([MarshalAs(UnmanagedType.Bool)] out bool b);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice {
    int Activate(ref Guid id, uint clsCtx, IntPtr par, [MarshalAs(UnmanagedType.IUnknown)] out object ppv);
}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(uint flow, uint mask, out IntPtr devs);
    int GetDefaultAudioEndpoint(uint flow, uint role, out IMMDevice dev);
}
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
public class MMDeviceEnumeratorClass {}
public static class AudioHelper {
    public static string GetVolumeState() {
        var e = (IMMDeviceEnumerator)new MMDeviceEnumeratorClass();
        IMMDevice d; e.GetDefaultAudioEndpoint(0, 1, out d);
        var g = new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");
        object o; d.Activate(ref g, 23, IntPtr.Zero, out o);
        var v = (IAudioEndpointVolume)o;
        float l; v.GetMasterVolumeLevelScalar(out l);
        bool m; v.GetMute(out m);
        return ((int)(l * 100)).ToString() + " " + m.ToString().ToLower();
    }
}
'@
[AudioHelper]::GetVolumeState()
