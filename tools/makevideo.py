# 把 tmp/frames/*.png 合成 mp4（8fps 截帧 -> 24fps 慢放更顺滑也行，这里直接 8fps 原速）
import glob, os
import imageio.v3 as iio
import imageio_ffmpeg

frames = sorted(glob.glob('tmp/frames/*.png'))
assert frames, 'no frames'
out = '碎碎念念·展馆漫游.mp4'
ff = imageio_ffmpeg.get_ffmpeg_exe()
first = iio.imread(frames[0])
h, w = first.shape[:2]
cmd = [ff, '-y', '-f', 'image2pipe', '-framerate', str(8), '-i', '-',
       '-vf', f'scale={w - w % 2}:{h - h % 2}', '-c:v', 'libx264', '-preset', 'medium',
       '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]
p = imageio_ffmpeg._subprocess.Popen(cmd, stdin=imageio_ffmpeg._subprocess.PIPE,
                                     stderr=imageio_ffmpeg._subprocess.DEVNULL)
for i, f in enumerate(frames):
    p.stdin.write(iio.imread(f).tobytes())
    if i % 50 == 0:
        print(f'{i}/{len(frames)}')
p.stdin.close()
p.wait()
print('saved', out, os.path.getsize(out) // 1024, 'KB', f'{w}x{h}', len(frames), 'frames')
