@echo off
echo Đang khoi dong Web Dashboard qua Docker...
start /b docker-compose up -d

echo.
echo ==============================================
echo KHOI DONG DUONG HAM MANG (LOCALTUNNEL)
echo Duong link Camera co dinh se la: 
echo https://fire-cam-iot.loca.lt/video_feed
echo Web Dashboard cua ban se tu dong ket noi!
echo ==============================================
start "LocalTunnel" cmd /k "npx localtunnel --port 5000 --subdomain fire-cam-iot"

echo.
echo Đang khoi dong AI Camera...
python src\fire_ai.py

pause
