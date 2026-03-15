## How to install MicroPython libraries
Connect to Wi-Fi first.
import network
wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect("Phòng 1001_5G", "Qhp10133")

## Then install urequests
import mip
mip.install("requests")
