import network
import time
import upip

wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect("Phòng 1001_5G", "Qhp10133")

while not wlan.isconnected():
    time.sleep(1)
    print("Connecting to WiFi...")

print("Connected to WiFi!")
print("Installing urequests...")
upip.install("micropython-urequests")
print("Done!")
